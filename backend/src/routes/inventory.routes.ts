import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { stockAdjustmentSchema } from "../models/inventory.model";
import { createStockAdjustment } from "../services/inventory.service";

export const inventoryRoutes = Router();

inventoryRoutes.post(
  "/stock-adjustments",
  requireAuth,
  requirePermission("inventory.adjust"),
  requireModuleEnabled("inventory"),
  asyncHandler(async (req, res) => {
    const input = stockAdjustmentSchema.parse(req.body);
    const data = await createStockAdjustment(req.auth!, input);
    res.status(201).json({ success: true, data });
  }),
);
