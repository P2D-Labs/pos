import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { listQuerySchema } from "../models/common.model";
import type { SalesReturnCreateInput } from "../models/sales-return.model";
import { itemTracksInventory, toPrimaryQuantity } from "./stock.service";

export async function listSalesReturns(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.salesReturn.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { salesReturnNo: { contains: list.search, mode: "insensitive" } },
            { sourceInvoiceId: { contains: list.search, mode: "insensitive" } },
            { customerId: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function getSalesReturnById(auth: AuthUser, id: string) {
  const salesReturn = await prisma.salesReturn.findFirst({
    where: { businessId: auth.businessId, id },
  });
  if (!salesReturn) throw new HttpError(404, "Sales return not found");
  const lines = await prisma.salesReturnLine.findMany({
    where: { salesReturnId: salesReturn.id },
  });
  return { ...salesReturn, lines };
}

export async function createSalesReturn(auth: AuthUser, input: SalesReturnCreateInput) {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: auth.businessId },
  });
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: input.sourceInvoiceId, businessId: auth.businessId },
  });
  if (!invoice) throw new HttpError(404, "Source invoice not found");
  if (invoice.customerId !== input.customerId) {
    throw new HttpError(400, "Customer does not match the source invoice");
  }

  const invoiceLineIds = input.lines.map((line) => line.salesInvoiceLineId);
  if (new Set(invoiceLineIds).size !== invoiceLineIds.length) {
    throw new HttpError(400, "Duplicate invoice line in return — each line may appear only once");
  }

  const invoiceLines = await prisma.salesInvoiceLine.findMany({
    where: { salesInvoiceId: invoice.id, id: { in: invoiceLineIds } },
  });
  const lineMap = new Map(invoiceLines.map((line) => [line.id, line]));

  const returnCount = await prisma.salesReturn.count({
    where: { businessId: auth.businessId },
  });
  const salesReturnNo = `${business.salesReturnPrefix}-${returnCount + 1}`;

  let subtotal = 0;
  let totalTax = 0;

  const calculatedLines: Array<{
    sourceLine: Awaited<ReturnType<typeof prisma.salesInvoiceLine.findFirstOrThrow>>;
    enteredQuantity: number;
    quantityPrimary: number;
    taxAmount: number;
    lineTotal: number;
    reason?: string;
  }> = [];

  for (const line of input.lines) {
    const sourceLine = lineMap.get(line.salesInvoiceLineId);
    if (!sourceLine) throw new HttpError(400, "Return line is not part of source invoice");
    const returnedQtyAggregate = await prisma.salesReturnLine.aggregate({
      _sum: { quantityPrimary: true },
      where: { salesInvoiceLineId: sourceLine.id },
    });
    const alreadyReturned = Number(returnedQtyAggregate._sum.quantityPrimary ?? 0);
    const requestedPrimary = toPrimaryQuantity({
      enteredQuantity: line.enteredQuantity,
      unitType: sourceLine.unitType,
      factor: sourceLine.conversionFactor ? Number(sourceLine.conversionFactor) : null,
    });
    if (alreadyReturned + requestedPrimary > Number(sourceLine.quantityPrimary)) {
      throw new HttpError(400, "Return quantity exceeds sold quantity");
    }
    const ratio = requestedPrimary / Number(sourceLine.quantityPrimary);
    const lineTax = Number(sourceLine.taxAmount) * ratio;
    const lineDiscount = Number(sourceLine.discountAmount) * ratio;
    const gross = requestedPrimary * Number(sourceLine.unitPrice);
    const lineTotal = gross - lineDiscount + lineTax;
    subtotal += gross - lineDiscount;
    totalTax += lineTax;
    calculatedLines.push({
      sourceLine,
      enteredQuantity: line.enteredQuantity,
      quantityPrimary: requestedPrimary,
      taxAmount: lineTax,
      lineTotal,
      reason: line.reason,
    });
  }

  const grandTotal = subtotal + totalTax;
  /** Single path: credit customer store balance (no cash-out at return time). */
  const returnMethod = "EXCHANGE" as const;
  const cashRefundAmount = 0;
  const exchangeAdjustmentAmount = grandTotal;

  const returnItemIds = [...new Set(calculatedLines.map((r) => r.sourceLine.itemId))];
  const returnItems = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: returnItemIds } },
    select: { id: true, trackInventory: true },
  });
  const trackByItemId = new Map(returnItems.map((i) => [i.id, i.trackInventory]));

  return prisma.$transaction(async (tx) => {
    const salesReturn = await tx.salesReturn.create({
      data: {
        businessId: auth.businessId,
        salesReturnNo,
        sourceInvoiceId: invoice.id,
        customerId: input.customerId,
        returnMethod,
        subtotal,
        discountAmount: 0,
        taxAmount: totalTax,
        grandTotal,
        cashRefundAmount,
        exchangeAdjustmentAmount,
        createdBy: auth.sub,
      },
    });

    for (const row of calculatedLines) {
      await tx.salesReturnLine.create({
        data: {
          salesReturnId: salesReturn.id,
          salesInvoiceLineId: row.sourceLine.id,
          itemId: row.sourceLine.itemId,
          enteredQuantity: row.enteredQuantity,
          unitType: row.sourceLine.unitType,
          unitId: row.sourceLine.unitId,
          conversionFactor: row.sourceLine.conversionFactor,
          quantityPrimary: row.quantityPrimary,
          unitPrice: row.sourceLine.unitPrice,
          taxRate: row.sourceLine.taxRate,
          taxAmount: row.taxAmount,
          lineTotal: row.lineTotal,
          reason: row.reason,
        },
      });

      if (itemTracksInventory({ trackInventory: trackByItemId.get(row.sourceLine.itemId) })) {
        await tx.stockTransaction.create({
          data: {
            businessId: auth.businessId,
            itemId: row.sourceLine.itemId,
            transactionType: "SALE_RETURN",
            referenceType: "SALES_RETURN",
            referenceId: salesReturn.id,
            quantityPrimaryIn: row.quantityPrimary,
            quantityPrimaryOut: 0,
            enteredQuantity: row.enteredQuantity,
            enteredUnitType: row.sourceLine.unitType,
            enteredUnitId: row.sourceLine.unitId,
            conversionFactor: row.sourceLine.conversionFactor,
            lineValue: row.lineTotal,
            createdBy: auth.sub,
          },
        });

        await tx.item.update({
          where: { id: row.sourceLine.itemId },
          data: { currentStockPrimary: { increment: row.quantityPrimary } },
        });
      }
    }

    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: "SALES",
        accountId: input.customerId,
        referenceType: "SALES_RETURN",
        referenceId: salesReturn.id,
        debitAmount: 0,
        creditAmount: grandTotal,
        narration: `Sales return ${salesReturn.salesReturnNo}`,
      },
    });

    if (grandTotal > 0) {
      await tx.customer.update({
        where: { id: input.customerId, businessId: auth.businessId },
        data: { storeCreditBalance: { increment: grandTotal } },
      });
    }

    return salesReturn;
  });
}
