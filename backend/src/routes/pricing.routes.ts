import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { getItemPriceHistory, getResolvedItemPrice } from "../services/pricing.service";

const priceResolveSchema = z.object({
  itemId: z.string(),
  unitType: z.enum(["PRIMARY", "SECONDARY"]),
  unitId: z.string(),
});

export const pricingRoutes = Router();

pricingRoutes.get(
  "/items/:id/resolved-price",
  requireAuth,
  requirePermission("pricing.view"),
  requireModuleEnabled("pricing"),
  asyncHandler(async (req, res) => {
    const input = priceResolveSchema.parse({
      itemId: String(req.params.id),
      unitType: req.query.unitType,
      unitId: req.query.unitId,
    });
    const data = await getResolvedItemPrice(req.auth!, input);
    res.json({ success: true, data });
  }),
);

pricingRoutes.get(
  "/items/:id/price-history",
  requireAuth,
  requirePermission("pricing.view"),
  requireModuleEnabled("pricing"),
  asyncHandler(async (req, res) => {
    const data = await getItemPriceHistory(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);
