import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { salesOrderCreateSchema } from "../models/sales-order.model";
import { createSalesOrder, listSalesOrders } from "../services/sales-order.service";

export const salesOrderRoutes = Router();

salesOrderRoutes.get(
  "/sales-orders",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("salesOrders"),
  asyncHandler(async (req, res) => {
    const documentTaxMode = req.query.documentTaxMode as "TAX" | "NON_TAX" | undefined;
    const data = await listSalesOrders(req.auth!, documentTaxMode, req.query);
    res.json({ success: true, data });
  }),
);

salesOrderRoutes.post(
  "/sales-orders",
  requireAuth,
  requirePermission("sales.create"),
  requireModuleEnabled("salesOrders"),
  asyncHandler(async (req, res) => {
    const input = salesOrderCreateSchema.parse(req.body);
    const data = await createSalesOrder(req.auth!, input);
    res.status(201).json({ success: true, data });
  }),
);
