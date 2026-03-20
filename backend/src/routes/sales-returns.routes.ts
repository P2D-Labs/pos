import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { salesReturnCreateSchema } from "../models/sales-return.model";
import {
  createSalesReturn,
  getSalesReturnById,
  listSalesReturns,
} from "../services/sales-return.service";

export const salesReturnRoutes = Router();

salesReturnRoutes.get(
  "/sales-returns",
  requireAuth,
  requirePermission("returns.view"),
  requireModuleEnabled("salesReturns"),
  asyncHandler(async (req, res) => {
    const data = await listSalesReturns(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

salesReturnRoutes.post(
  "/sales-returns",
  requireAuth,
  requirePermission("returns.create"),
  requireModuleEnabled("salesReturns"),
  asyncHandler(async (req, res) => {
    const input = salesReturnCreateSchema.parse(req.body);
    const data = await createSalesReturn(req.auth!, input);
    res.status(201).json({ success: true, data });
  }),
);

salesReturnRoutes.get(
  "/sales-returns/:id",
  requireAuth,
  requirePermission("returns.view"),
  requireModuleEnabled("salesReturns"),
  asyncHandler(async (req, res) => {
    const data = await getSalesReturnById(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);
