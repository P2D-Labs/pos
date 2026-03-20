import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { createSupplier, listSuppliers } from "../services/supplier.service";

export const supplierRoutes = Router();

supplierRoutes.get(
  "/suppliers",
  requireAuth,
  requirePermission("suppliers.view"),
  asyncHandler(async (req, res) => {
    const data = await listSuppliers(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

supplierRoutes.post(
  "/suppliers",
  requireAuth,
  requirePermission("suppliers.create"),
  asyncHandler(async (req, res) => {
    const data = await createSupplier(req.auth!, req.body);
    res.status(201).json({ success: true, data });
  }),
);
