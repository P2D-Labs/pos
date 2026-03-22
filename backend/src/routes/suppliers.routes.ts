import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { createSupplier, getSupplierById, listSuppliers, updateSupplier } from "../services/supplier.service";

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

supplierRoutes.get(
  "/suppliers/:id",
  requireAuth,
  requirePermission("suppliers.view"),
  asyncHandler(async (req, res) => {
    const data = await getSupplierById(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);

supplierRoutes.patch(
  "/suppliers/:id",
  requireAuth,
  requirePermission("suppliers.create"),
  asyncHandler(async (req, res) => {
    const data = await updateSupplier(req.auth!, String(req.params.id), req.body);
    res.json({ success: true, data });
  }),
);
