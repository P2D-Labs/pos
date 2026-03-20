import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { listQuerySchema } from "../models/common.model";
import type { QuotationCreateInput } from "../models/quotation.model";
import { toPrimaryQuantity } from "./stock.service";

export async function listQuotations(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.quotation.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { quotationNo: { contains: list.search, mode: "insensitive" } },
            { customerId: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createQuotation(auth: AuthUser, input: QuotationCreateInput) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: auth.businessId } });
  const count = await prisma.quotation.count({ where: { businessId: auth.businessId } });
  const quotationNo = `${business.quotationPrefix}-${count + 1}`;

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const items = await prisma.item.findMany({ where: { businessId: auth.businessId, id: { in: itemIds } } });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  const rows = input.lines.map((line) => {
    const item = itemMap.get(line.itemId)!;
    const quantityPrimary = toPrimaryQuantity({
      enteredQuantity: line.enteredQuantity,
      unitType: line.unitType,
      factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
    });
    const preTax = line.enteredQuantity * line.unitPrice - line.discountAmount;
    const lineTax = (preTax * line.taxRate) / 100;
    const lineTotal = preTax + lineTax;
    subtotal += preTax;
    taxAmount += lineTax;
    discountAmount += line.discountAmount;
    return { line, item, quantityPrimary, lineTax, lineTotal };
  });

  return prisma.$transaction(async (tx) => {
    const record = await tx.quotation.create({
      data: {
        businessId: auth.businessId,
        quotationNo,
        customerId: input.customerId,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal: subtotal + taxAmount,
        createdBy: auth.sub,
      },
    });
    for (const row of rows) {
      await tx.quotationLine.create({
        data: {
          quotationId: record.id,
          itemId: row.item.id,
          enteredQuantity: row.line.enteredQuantity,
          unitType: row.line.unitType,
          unitId: row.line.unitId,
          conversionFactor: row.line.unitType === "SECONDARY" ? row.item.secondaryToPrimaryFactor : null,
          quantityPrimary: row.quantityPrimary,
          unitPrice: row.line.unitPrice,
          priceSource: "MANUAL",
          discountAmount: row.line.discountAmount,
          taxRate: row.line.taxRate,
          taxAmount: row.lineTax,
          lineTotal: row.lineTotal,
        },
      });
      await tx.itemPriceHistory.create({
        data: {
          businessId: auth.businessId,
          itemId: row.item.id,
          sourceType: "QUOTATION",
          sourceId: record.id,
          unitType: row.line.unitType,
          unitId: row.line.unitId,
          price: row.line.unitPrice,
          discountAmount: row.line.discountAmount,
        },
      });
    }
    return record;
  });
}

export async function convertQuotationToInvoice(auth: AuthUser, quotationId: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, businessId: auth.businessId },
  });
  if (!quotation) throw new HttpError(404, "Quotation not found");
  const lines = await prisma.quotationLine.findMany({
    where: { quotationId: quotation.id },
  });
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: auth.businessId },
  });
  const invoiceSeries = business.taxInvoicePrefix;
  const seriesCount = await prisma.salesInvoice.count({
    where: { businessId: auth.businessId, invoiceSeries },
  });
  const invoiceNo = `${invoiceSeries}-${seriesCount + 1}`;

  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  const items = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: itemIds } },
  });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  const calculatedLines = lines.map((line) => {
    const item = itemMap.get(line.itemId);
    if (!item) throw new HttpError(404, `Item not found: ${line.itemId}`);
    const quantityPrimary = toPrimaryQuantity({
      enteredQuantity: Number(line.enteredQuantity),
      unitType: line.unitType,
      factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
    });
    if (!item.allowNegativeStock && Number(item.currentStockPrimary) < quantityPrimary) {
      throw new HttpError(400, `Insufficient stock for item ${item.name}`);
    }
    const preTax = Number(line.enteredQuantity) * Number(line.unitPrice) - Number(line.discountAmount);
    const taxAmount = (preTax * Number(line.taxRate)) / 100;
    const lineTotal = preTax + taxAmount;
    subtotal += preTax;
    totalTax += taxAmount;
    totalDiscount += Number(line.discountAmount);
    return { line, item, quantityPrimary, taxAmount, lineTotal };
  });

  const grandTotal = subtotal + totalTax;
  return prisma.$transaction(async (tx) => {
    const record = await tx.salesInvoice.create({
      data: {
        businessId: auth.businessId,
        invoiceNo,
        invoiceSeries,
        documentTaxMode: "TAX",
        customerId: quotation.customerId,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        grandTotal,
        amountReceived: 0,
        balanceDue: grandTotal,
        createdBy: auth.sub,
      },
    });
    for (const row of calculatedLines) {
      await tx.salesInvoiceLine.create({
        data: {
          salesInvoiceId: record.id,
          itemId: row.item.id,
          enteredQuantity: row.line.enteredQuantity,
          unitType: row.line.unitType,
          unitId: row.line.unitId,
          conversionFactor:
            row.line.unitType === "SECONDARY" && row.item.secondaryToPrimaryFactor
              ? row.item.secondaryToPrimaryFactor
              : null,
          quantityPrimary: row.quantityPrimary,
          unitPrice: row.line.unitPrice,
          priceSource: row.line.priceSource,
          discountAmount: row.line.discountAmount,
          taxRate: row.line.taxRate,
          taxAmount: row.taxAmount,
          lineTotal: row.lineTotal,
        },
      });
      await tx.stockTransaction.create({
        data: {
          businessId: auth.businessId,
          itemId: row.item.id,
          transactionType: "SALE",
          referenceType: "SALES_INVOICE",
          referenceId: record.id,
          quantityPrimaryIn: 0,
          quantityPrimaryOut: row.quantityPrimary,
          enteredQuantity: row.line.enteredQuantity,
          enteredUnitType: row.line.unitType,
          enteredUnitId: row.line.unitId,
          conversionFactor:
            row.line.unitType === "SECONDARY" && row.item.secondaryToPrimaryFactor
              ? row.item.secondaryToPrimaryFactor
              : null,
          lineValue: row.lineTotal,
          createdBy: auth.sub,
        },
      });
      await tx.item.update({
        where: { id: row.item.id },
        data: { currentStockPrimary: { decrement: row.quantityPrimary } },
      });
    }
    await tx.auditLog.create({
      data: {
        businessId: auth.businessId,
        userId: auth.sub,
        action: "QUOTATION_CONVERT_TO_INVOICE",
        entityType: "Quotation",
        entityId: quotation.id,
        after: { salesInvoiceId: record.id, invoiceNo: record.invoiceNo },
      },
    });
    return record;
  });
}
