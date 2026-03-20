import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { listQuerySchema } from "../models/common.model";
import type { SalesReturnCreateInput } from "../models/sales-return.model";
import { toPrimaryQuantity } from "./stock.service";

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

  const invoiceLineIds = input.lines.map((line) => line.salesInvoiceLineId);
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
  const cashRefundAmount = input.returnMethod === "CASH_REFUND" ? grandTotal : 0;
  const exchangeAdjustmentAmount = input.returnMethod === "EXCHANGE" ? grandTotal : 0;

  return prisma.$transaction(async (tx) => {
    const salesReturn = await tx.salesReturn.create({
      data: {
        businessId: auth.businessId,
        salesReturnNo,
        sourceInvoiceId: invoice.id,
        customerId: input.customerId,
        returnMethod: input.returnMethod,
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

    if (input.returnMethod === "CASH_REFUND" && cashRefundAmount > 0) {
      await tx.payment.create({
        data: {
          businessId: auth.businessId,
          referenceType: "SALES_RETURN_REFUND",
          referenceId: salesReturn.id,
          method: "CASH",
          amount: cashRefundAmount,
          createdBy: auth.sub,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          businessId: auth.businessId,
          accountType: "REFUND",
          accountId: input.customerId,
          referenceType: "SALES_RETURN_REFUND",
          referenceId: salesReturn.id,
          debitAmount: cashRefundAmount,
          creditAmount: 0,
          narration: `Cash refund for ${salesReturn.salesReturnNo}`,
        },
      });
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

    return salesReturn;
  });
}
