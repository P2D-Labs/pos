import { HttpError } from "../lib/http";

export function itemTracksInventory(item: { trackInventory?: boolean | null }): boolean {
  return item.trackInventory !== false;
}

export function toPrimaryQuantity(input: {
  enteredQuantity: number;
  unitType: "PRIMARY" | "SECONDARY";
  factor?: number | null;
}) {
  if (input.unitType === "PRIMARY") return input.enteredQuantity;
  if (!input.factor || input.factor <= 0) {
    throw new HttpError(400, "Missing conversion factor for secondary unit");
  }
  return input.enteredQuantity * input.factor;
}

/** Ensures line unitType/unitId match the item's primary/secondary configuration and flags. */
export function validateDocumentLineUnits(
  item: {
    name?: string;
    primaryUnitId: string | null;
    secondaryUnitId: string | null;
    secondaryToPrimaryFactor: unknown;
    allowSalesInSecondaryUnit: boolean;
    allowPurchaseInSecondaryUnit: boolean;
  },
  line: { unitType: "PRIMARY" | "SECONDARY"; unitId: string },
  context: "SALES" | "PURCHASE" | "ADJUSTMENT" | "QUOTATION",
) {
  const label = item.name ? ` (${item.name})` : "";
  if (line.unitType === "PRIMARY") {
    if (item.primaryUnitId && line.unitId !== item.primaryUnitId) {
      throw new HttpError(400, `Primary unit does not match this item${label}`);
    }
    return;
  }
  if (!item.secondaryUnitId) {
    throw new HttpError(400, `Item has no secondary unit${label}`);
  }
  if (line.unitId !== item.secondaryUnitId) {
    throw new HttpError(400, `Secondary unit does not match this item${label}`);
  }
  const factor = item.secondaryToPrimaryFactor != null ? Number(item.secondaryToPrimaryFactor) : 0;
  if (!factor || factor <= 0) {
    throw new HttpError(400, `Secondary unit requires a conversion factor on the item${label}`);
  }
  if (context === "SALES" || context === "QUOTATION") {
    if (!item.allowSalesInSecondaryUnit) {
      throw new HttpError(400, `Sales in secondary unit is not enabled for this item${label}`);
    }
  } else if (context === "PURCHASE") {
    if (!item.allowPurchaseInSecondaryUnit) {
      throw new HttpError(400, `Purchase in secondary unit is not enabled for this item${label}`);
    }
  }
}
