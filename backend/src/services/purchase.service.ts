import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { listQuerySchema } from "../models/common.model";
import type { PurchaseCreateInput } from "../models/purchase.model";
import { itemTracksInventory, toPrimaryQuantity, validateDocumentLineUnits } from "./stock.service";

export async function listPurchases(auth: AuthUser, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.purchase.findMany({
    where: {
      businessId: auth.businessId,
      OR: list.search
        ? [
            { purchaseNo: { contains: list.search, mode: "insensitive" } },
            { supplierId: { contains: list.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createPurchase(auth: AuthUser, input: PurchaseCreateInput) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: auth.businessId } });
  const purchaseCount = await prisma.purchase.count({
    where: { businessId: auth.businessId },
  });
  const purchaseNo = `${business.purchasePrefix}-${purchaseCount + 1}`;

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const items = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: itemIds } },
  });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  let subtotal = 0;
  let totalTax = 0;

  const calculatedLines = input.lines.map((line) => {
    const item = itemMap.get(line.itemId)!;
    validateDocumentLineUnits(item, line, "PURCHASE");
    const quantityPrimary = toPrimaryQuantity({
      enteredQuantity: line.enteredQuantity,
      unitType: line.unitType,
      factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
    });
    const preTax = line.enteredQuantity * line.unitCost;
    const taxAmount = (preTax * line.taxRate) / 100;
    const lineTotal = preTax + taxAmount;
    subtotal += preTax;
    totalTax += taxAmount;
    return { line, item, quantityPrimary, taxAmount, lineTotal };
  });

  const grandTotal = subtotal + totalTax;
  const balancePayable = Math.max(grandTotal - input.amountPaid, 0);

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        businessId: auth.businessId,
        purchaseNo,
        supplierId: input.supplierId,
        subtotal,
        discountAmount: 0,
        taxAmount: totalTax,
        grandTotal,
        amountPaid: input.amountPaid,
        balancePayable,
        createdBy: auth.sub,
      },
    });

    for (const row of calculatedLines) {
      await tx.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          itemId: row.item.id,
          enteredQuantity: row.line.enteredQuantity,
          unitType: row.line.unitType,
          unitId: row.line.unitId,
          conversionFactor:
            row.line.unitType === "SECONDARY" && row.item.secondaryToPrimaryFactor
              ? row.item.secondaryToPrimaryFactor
              : null,
          quantityPrimary: row.quantityPrimary,
          unitCost: row.line.unitCost,
          taxRate: row.line.taxRate,
          taxAmount: row.taxAmount,
          lineTotal: row.lineTotal,
        },
      });
      await tx.itemPriceHistory.create({
        data: {
          businessId: auth.businessId,
          itemId: row.item.id,
          sourceType: "PURCHASE",
          sourceId: purchase.id,
          unitType: row.line.unitType,
          unitId: row.line.unitId,
          price: row.line.unitCost,
          discountAmount: 0,
        },
      });

      if (itemTracksInventory(row.item)) {
        await tx.stockTransaction.create({
          data: {
            businessId: auth.businessId,
            itemId: row.item.id,
            transactionType: "PURCHASE",
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            quantityPrimaryIn: row.quantityPrimary,
            quantityPrimaryOut: 0,
            enteredQuantity: row.line.enteredQuantity,
            enteredUnitType: row.line.unitType,
            enteredUnitId: row.line.unitId,
            conversionFactor:
              row.line.unitType === "SECONDARY" && row.item.secondaryToPrimaryFactor
                ? row.item.secondaryToPrimaryFactor
                : null,
            unitCost: row.line.unitCost,
            lineValue: row.lineTotal,
            createdBy: auth.sub,
          },
        });
      }

      await tx.item.update({
        where: { id: row.item.id },
        data: {
          purchasePricePrimary: row.line.unitCost,
          ...(itemTracksInventory(row.item)
            ? { currentStockPrimary: { increment: row.quantityPrimary } }
            : {}),
        },
      });
    }

    await tx.ledgerEntry.create({
      data: {
        businessId: auth.businessId,
        accountType: "PURCHASE",
        accountId: input.supplierId,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        debitAmount: grandTotal,
        creditAmount: grandTotal - input.amountPaid,
        narration: `Purchase ${purchase.purchaseNo}`,
      },
    });
    if (input.amountPaid > 0) {
      await tx.payment.create({
        data: {
          businessId: auth.businessId,
          referenceType: "PURCHASE_PAYMENT",
          referenceId: purchase.id,
          method: "CASH",
          amount: input.amountPaid,
          createdBy: auth.sub,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          businessId: auth.businessId,
          accountType: "CASH",
          referenceType: "PURCHASE_PAYMENT",
          referenceId: purchase.id,
          debitAmount: 0,
          creditAmount: input.amountPaid,
          narration: `Payment for ${purchase.purchaseNo}`,
        },
      });
    }

    return purchase;
  });
}
