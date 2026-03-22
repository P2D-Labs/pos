import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { hasPermission } from "../middleware/permissions";

/** Till line price: last sale (order/invoice) → last supplier purchase cost → item sales price; editable when user can sell. */
export async function getResolvedItemPrice(auth: AuthUser, input: { itemId: string; unitType: "PRIMARY" | "SECONDARY"; unitId: string }) {
  const canEditPrice = hasPermission(auth, "*") || hasPermission(auth, "sales.create");
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, businessId: auth.businessId },
    select: { id: true, salesPricePrimary: true, secondaryToPrimaryFactor: true, primaryUnitId: true, secondaryUnitId: true },
  });
  if (!item) {
    throw new HttpError(404, "Item not found");
  }
  if (input.unitType === "PRIMARY" && item.primaryUnitId && input.unitId !== item.primaryUnitId) {
    throw new HttpError(400, "Invalid primary unit for selected item");
  }
  if (input.unitType === "SECONDARY") {
    const expectedSecondary = item.secondaryUnitId ?? item.primaryUnitId;
    if (expectedSecondary && input.unitId !== expectedSecondary) {
      throw new HttpError(400, "Invalid secondary unit for selected item");
    }
  }

  const lastSalePrice = await prisma.itemPriceHistory.findFirst({
    where: {
      businessId: auth.businessId,
      itemId: input.itemId,
      unitType: input.unitType,
      unitId: input.unitId,
      sourceType: { in: ["SALES_ORDER", "SALES_INVOICE"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (lastSalePrice) {
    return {
      price: Number(lastSalePrice.price),
      source: "LAST_SALE",
      sourceReferenceId: lastSalePrice.sourceId,
      canEdit: canEditPrice,
    };
  }

  const lastPurchaseCost = await prisma.itemPriceHistory.findFirst({
    where: {
      businessId: auth.businessId,
      itemId: input.itemId,
      unitType: input.unitType,
      unitId: input.unitId,
      sourceType: "PURCHASE",
    },
    orderBy: { createdAt: "desc" },
  });
  if (lastPurchaseCost) {
    return {
      price: Number(lastPurchaseCost.price),
      source: "LAST_PURCHASE",
      sourceReferenceId: lastPurchaseCost.sourceId,
      canEdit: canEditPrice,
    };
  }

  let price = Number(item.salesPricePrimary ?? 0);
  let source = "ITEM_DEFAULT";
  if (input.unitType === "SECONDARY" && item.secondaryToPrimaryFactor) {
    price = price * Number(item.secondaryToPrimaryFactor);
    source = "DERIVED_FROM_PRIMARY";
  }
  return { price, source, canEdit: canEditPrice };
}
