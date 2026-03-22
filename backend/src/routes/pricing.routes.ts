import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getResolvedItemPrice } from "../services/pricing.service";

const priceResolveSchema = z.object({
  itemId: z.string(),
  unitType: z.enum(["PRIMARY", "SECONDARY"]),
  unitId: z.string(),
});

export const pricingRoutes = Router();

/** Used by Till/POS to suggest line unit price — no separate Pricing module. */
pricingRoutes.get(
  "/items/:id/resolved-price",
  requireAuth,
  requirePermission("sales.view"),
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
