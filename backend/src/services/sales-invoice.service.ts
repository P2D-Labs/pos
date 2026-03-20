import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { enforceNonTaxPermission, hasPermission } from "../middleware/permissions";
import { listQuerySchema } from "../models/common.model";
import type { SalesInvoiceCreateInput } from "../models/sales-invoice.model";
import { toPrimaryQuantity } from "./stock.service";

export async function listSalesInvoices(
  auth: AuthUser,
  documentTaxMode: "TAX" | "NON_TAX" | undefined,
  query: unknown,
) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  if (documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "view");
  return prisma.salesInvoice.findMany({
    where: {
      businessId: auth.businessId,
      documentTaxMode: documentTaxMode ?? (canViewNonTax ? undefined : "TAX"),
      OR: list.search
        ? [
            { invoiceNo: { contains: list.search, mode: "insensitive" } },
            { customerId: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getSalesInvoice(auth: AuthUser, id: string) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (invoice.documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "view");
  const lines = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: invoice.id } });
  return { ...invoice, lines };
}

export async function createSalesInvoice(auth: AuthUser, input: SalesInvoiceCreateInput) {
  if (input.documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "create");
  const business = await prisma.business.findUniqueOrThrow({ where: { id: auth.businessId } });

  const invoiceSeries = input.documentTaxMode === "TAX" ? business.taxInvoicePrefix : business.nonTaxInvoicePrefix;
  const seriesCount = await prisma.salesInvoice.count({
    where: { businessId: auth.businessId, invoiceSeries },
  });
  const invoiceNo = `${invoiceSeries}-${seriesCount + 1}`;

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const items = await prisma.item.findMany({ where: { businessId: auth.businessId, id: { in: itemIds } } });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  const calculatedLines = input.lines.map((line) => {
    const item = itemMap.get(line.itemId);
    if (!item) throw new HttpError(404, `Item not found: ${line.itemId}`);
    const quantityPrimary = toPrimaryQuantity({
      enteredQuantity: line.enteredQuantity,
      unitType: line.unitType,
      factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
    });
    if (!item.allowNegativeStock && Number(item.currentStockPrimary) < quantityPrimary) {
      throw new HttpError(400, `Insufficient stock for item ${item.name}`);
    }
    const taxableRate = input.documentTaxMode === "NON_TAX" || !item.taxable ? 0 : line.taxRate;
    const preTax = line.enteredQuantity * line.unitPrice - line.discountAmount;
    const taxAmount = (preTax * taxableRate) / 100;
    const lineTotal = preTax + taxAmount;
    subtotal += preTax;
    totalTax += taxAmount;
    totalDiscount += line.discountAmount;
    return { line, item, quantityPrimary, taxRate: taxableRate, taxAmount, lineTotal };
  });

  const grandTotal = subtotal + totalTax;
  const balanceDue = Math.max(grandTotal - input.amountReceived, 0);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.create({
      data: {
        businessId: auth.businessId,
        invoiceNo,
        invoiceSeries,
        documentTaxMode: input.documentTaxMode,
        customerId: input.customerId,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        grandTotal,
        amountReceived: input.amountReceived,
        balanceDue,
        createdBy: auth.sub,
      },
    });
    for (const row of calculatedLines) {
      await tx.salesInvoiceLine.create({
        data: {
          salesInvoiceId: invoice.id,
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
          priceSource: "MANUAL",
          discountAmount: row.line.discountAmount,
          taxRate: row.taxRate,
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
          referenceId: invoice.id,
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
    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: "SALES",
        accountId: input.customerId,
        referenceType: "SALES_INVOICE",
        referenceId: invoice.id,
        debitAmount: grandTotal - input.amountReceived,
        creditAmount: grandTotal,
        narration: `Invoice ${invoice.invoiceNo}`,
      },
    });
    if (input.amountReceived > 0) {
      await tx.payment.create({
        data: {
          businessId: auth.businessId,
          referenceType: "SALES_INVOICE",
          referenceId: invoice.id,
          method: "CASH",
          amount: input.amountReceived,
          createdBy: auth.sub,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          businessId: auth.businessId,
          accountType: "CASH",
          referenceType: "PAYMENT_RECEIVED",
          referenceId: invoice.id,
          debitAmount: input.amountReceived,
          creditAmount: 0,
          narration: `Payment received for ${invoice.invoiceNo}`,
        },
      });
    }
    return invoice;
  });
}

export async function getReturnableItems(auth: AuthUser, invoiceId: string) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: invoiceId, businessId: auth.businessId },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (invoice.documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "view");
  const lines = await prisma.salesInvoiceLine.findMany({
    where: { salesInvoiceId: invoice.id },
  });
  const rows = [];
  for (const line of lines) {
    const returned = await prisma.salesReturnLine.aggregate({
      _sum: { quantityPrimary: true },
      where: { salesInvoiceLineId: line.id },
    });
    const returnedQty = Number(returned._sum.quantityPrimary ?? 0);
    const soldQty = Number(line.quantityPrimary);
    rows.push({
      salesInvoiceLineId: line.id,
      itemId: line.itemId,
      soldQuantityPrimary: soldQty,
      alreadyReturnedQuantityPrimary: returnedQty,
      returnableQuantityPrimary: Math.max(soldQty - returnedQty, 0),
    });
  }
  return rows;
}
