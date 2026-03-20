import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { hasPermission } from "../middleware/permissions";

export async function getResolvedItemPrice(auth: AuthUser, input: { itemId: string; unitType: "PRIMARY" | "SECONDARY"; unitId: string }) {
  const canManualOverride = hasPermission(auth, "pricing.override");
  const quotedHistory = await prisma.itemPriceHistory.findFirst({
    where: {
      businessId: auth.businessId,
      itemId: input.itemId,
      unitType: input.unitType,
      unitId: input.unitId,
      sourceType: { in: ["QUOTATION", "SALES_INVOICE"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (quotedHistory) {
    return {
      price: Number(quotedHistory.price),
      source: "LAST_QUOTED",
      sourceReferenceId: quotedHistory.sourceId,
      canEdit: canManualOverride,
    };
  }

  const inventoryHistory = await prisma.itemPriceHistory.findFirst({
    where: {
      businessId: auth.businessId,
      itemId: input.itemId,
      unitType: input.unitType,
      unitId: input.unitId,
      sourceType: "INVENTORY_UPDATE",
    },
    orderBy: { createdAt: "desc" },
  });
  if (inventoryHistory) {
    return {
      price: Number(inventoryHistory.price),
      source: "LAST_INVENTORY_UPDATE",
      sourceReferenceId: inventoryHistory.sourceId,
      canEdit: canManualOverride,
    };
  }

  const item = await prisma.item.findUniqueOrThrow({ where: { id: input.itemId } });
  let price = Number(item.salesPricePrimary ?? 0);
  let source = "ITEM_DEFAULT";
  if (input.unitType === "SECONDARY" && item.secondaryToPrimaryFactor) {
    price = price * Number(item.secondaryToPrimaryFactor);
    source = "DERIVED_FROM_PRIMARY";
  }
  return { price, source, canEdit: canManualOverride };
}

export async function getItemPriceHistory(auth: AuthUser, itemId: string) {
  return prisma.itemPriceHistory.findMany({
    where: { businessId: auth.businessId, itemId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
