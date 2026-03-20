import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { purchaseCreateSchema } from "../models/purchase.model";
import { createPurchase, listPurchases } from "../services/purchase.service";

export const purchaseRoutes = Router();

purchaseRoutes.get(
  "/purchases",
  requireAuth,
  requirePermission("purchases.view"),
  requireModuleEnabled("purchases"),
  asyncHandler(async (req, res) => {
    const data = await listPurchases(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

purchaseRoutes.post(
  "/purchases",
  requireAuth,
  requirePermission("purchases.create"),
  requireModuleEnabled("purchases"),
  asyncHandler(async (req, res) => {
    const input = purchaseCreateSchema.parse(req.body);
    const data = await createPurchase(req.auth!, input);
    res.status(201).json({ success: true, data });
  }),
);
