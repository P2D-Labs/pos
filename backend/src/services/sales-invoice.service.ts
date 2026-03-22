import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { enforceNonTaxPermission, hasPermission } from "../middleware/permissions";
import type { SalesInvoiceCreateInput } from "../models/sales-invoice.model";
import { salesInvoiceListQuerySchema } from "../models/sales-invoice.model";
import { itemTracksInventory, toPrimaryQuantity } from "./stock.service";

export async function listSalesInvoices(
  auth: AuthUser,
  documentTaxMode: "TAX" | "NON_TAX" | undefined,
  query: unknown,
) {
  const list = salesInvoiceListQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");
  if (documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "view");
  const where: Prisma.SalesInvoiceWhereInput = {
    businessId: auth.businessId,
    documentTaxMode: documentTaxMode ?? (canViewNonTax ? undefined : "TAX"),
  };
  if (list.customerId) where.customerId = list.customerId;
  if (list.openOnly) where.balanceDue = { gt: 0 };
  if (list.search) {
    where.OR = [
      { invoiceNo: { contains: list.search, mode: "insensitive" } },
      { customerId: { contains: list.search, mode: "insensitive" } },
    ];
  }
  return prisma.salesInvoice.findMany({
    where,
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

/** Standalone invoice creation is disabled — invoices are issued from Till/POS checkout (`createSalesInvoiceForOrderInTx`). */
export async function createSalesInvoice(auth: AuthUser, _input: SalesInvoiceCreateInput) {
  void _input;
  void auth;
  throw new HttpError(
    400,
    "Standalone sales invoices are disabled. Invoices are created automatically when you complete a sale on Till / POS.",
  );
}

/** Paired invoice for a till/POS sales order: stock + revenue ledger; payments stay on the sales order only. */
export async function createSalesInvoiceForOrderInTx(
  tx: Prisma.TransactionClient,
  auth: AuthUser,
  params: {
    salesOrderId: string;
    customerId: string;
    documentTaxMode: "TAX" | "NON_TAX";
    invoiceNo: string;
    invoiceSeries: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    amountReceived: number;
    balanceDue: number;
    lines: Array<{
      line: {
        itemId: string;
        enteredQuantity: number;
        unitType: "PRIMARY" | "SECONDARY";
        unitId: string;
        unitPrice: number;
        discountAmount: number;
        taxRate: number;
      };
      item: {
        id: string;
        name: string;
        taxable: boolean;
        trackInventory?: boolean | null;
        secondaryToPrimaryFactor: Prisma.Decimal | null;
      };
      quantityPrimary: number;
      itemTaxRate: number;
      lineTax: number;
      lineTotal: number;
    }>;
  },
) {
  const invoice = await tx.salesInvoice.create({
    data: {
      businessId: auth.businessId,
      salesOrderId: params.salesOrderId,
      invoiceNo: params.invoiceNo,
      invoiceSeries: params.invoiceSeries,
      documentTaxMode: params.documentTaxMode,
      customerId: params.customerId,
      subtotal: params.subtotal,
      discountAmount: params.discountAmount,
      taxAmount: params.taxAmount,
      grandTotal: params.grandTotal,
      amountReceived: params.amountReceived,
      balanceDue: params.balanceDue,
      createdBy: auth.sub,
    },
  });

  for (const row of params.lines) {
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
        taxRate: row.itemTaxRate,
        taxAmount: row.lineTax,
        lineTotal: row.lineTotal,
      },
    });
    await tx.itemPriceHistory.create({
      data: {
        businessId: auth.businessId,
        itemId: row.item.id,
        sourceType: "SALES_INVOICE",
        sourceId: invoice.id,
        unitType: row.line.unitType,
        unitId: row.line.unitId,
        price: row.line.unitPrice,
        discountAmount: row.line.discountAmount,
      },
    });
    if (itemTracksInventory(row.item)) {
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
  }

  await tx.ledgerEntry.create({
    data: {
      businessId: auth.businessId,
      accountType: "SALES",
      accountId: params.customerId,
      referenceType: "SALES_INVOICE",
      referenceId: invoice.id,
      debitAmount: params.grandTotal - params.amountReceived,
      creditAmount: params.grandTotal,
      narration: `Invoice ${invoice.invoiceNo} (order ${params.salesOrderId})`,
    },
  });

  return invoice;
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
  const itemIds = [...new Set(lines.map((l) => l.itemId))];
  const items = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: itemIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(items.map((i) => [i.id, i.name]));

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
      itemName: nameById.get(line.itemId) ?? line.itemId,
      soldQuantityPrimary: soldQty,
      alreadyReturnedQuantityPrimary: returnedQty,
      returnableQuantityPrimary: Math.max(soldQty - returnedQty, 0),
    });
  }
  return rows;
}
