import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { createProduct, listProducts } from "../services/product.service";

export const productRoutes = Router();

productRoutes.get(
  "/products",
  requireAuth,
  requirePermission("products.view"),
  asyncHandler(async (req, res) => {
    const data = await listProducts(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

productRoutes.post(
  "/products",
  requireAuth,
  requirePermission("products.create"),
  asyncHandler(async (req, res) => {
    const data = await createProduct(req.auth!, req.body);
    res.status(201).json({ success: true, data });
  }),
);

// Keep /items compatibility while frontend transitions.
productRoutes.get(
  "/items",
  requireAuth,
  requirePermission("products.view"),
  asyncHandler(async (req, res) => {
    const data = await listProducts(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

productRoutes.post(
  "/items",
  requireAuth,
  requirePermission("products.create"),
  asyncHandler(async (req, res) => {
    const data = await createProduct(req.auth!, req.body);
    res.status(201).json({ success: true, data });
  }),
);
