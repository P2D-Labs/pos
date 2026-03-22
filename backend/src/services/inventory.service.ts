import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import type { StockAdjustmentInput } from "../models/inventory.model";
import { itemTracksInventory, toPrimaryQuantity, validateDocumentLineUnits } from "./stock.service";

export async function createStockAdjustment(auth: AuthUser, input: StockAdjustmentInput) {
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, businessId: auth.businessId },
  });
  if (!item) throw new HttpError(404, "Item not found");
  if (!itemTracksInventory(item)) {
    throw new HttpError(400, "Stock adjustments apply only to items that track inventory");
  }
  validateDocumentLineUnits(
    item,
    { unitType: input.unitType, unitId: input.unitId },
    "ADJUSTMENT",
  );

  const quantityPrimary = toPrimaryQuantity({
    enteredQuantity: input.enteredQuantity,
    unitType: input.unitType,
    factor: item.secondaryToPrimaryFactor ? Number(item.secondaryToPrimaryFactor) : null,
  });

  if (input.direction === "OUT" && !item.allowNegativeStock && Number(item.currentStockPrimary) < quantityPrimary) {
    throw new HttpError(400, "Insufficient stock for adjustment out");
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.stockTransaction.create({
      data: {
        businessId: auth.businessId,
        itemId: item.id,
        transactionType: input.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        referenceType: "STOCK_ADJUSTMENT",
        referenceId: `${Date.now()}`,
        quantityPrimaryIn: input.direction === "IN" ? quantityPrimary : 0,
        quantityPrimaryOut: input.direction === "OUT" ? quantityPrimary : 0,
        enteredQuantity: input.enteredQuantity,
        enteredUnitType: input.unitType,
        enteredUnitId: input.unitId,
        conversionFactor:
          input.unitType === "SECONDARY" && item.secondaryToPrimaryFactor
            ? item.secondaryToPrimaryFactor
            : null,
        note: input.note,
        createdBy: auth.sub,
      },
    });

    await tx.item.update({
      where: { id: item.id },
      data: {
        currentStockPrimary:
          input.direction === "IN"
            ? { increment: quantityPrimary }
            : { decrement: quantityPrimary },
      },
    });

    return transaction;
  });
}
