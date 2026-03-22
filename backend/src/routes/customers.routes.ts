import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { createCustomer, getCustomerById, getCustomerCheckoutContext, listCustomers, updateCustomer } from "../services/customer.service";

export const customerRoutes = Router();

customerRoutes.get(
  "/customers",
  requireAuth,
  requirePermission("customers.view"),
  asyncHandler(async (req, res) => {
    const data = await listCustomers(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

customerRoutes.post(
  "/customers",
  requireAuth,
  requirePermission("customers.create"),
  asyncHandler(async (req, res) => {
    const data = await createCustomer(req.auth!, req.body);
    res.status(201).json({ success: true, data });
  }),
);

customerRoutes.get(
  "/customers/:id",
  requireAuth,
  requirePermission("customers.view"),
  asyncHandler(async (req, res) => {
    const data = await getCustomerById(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);

customerRoutes.get(
  "/customers/:id/checkout-context",
  requireAuth,
  requirePermission("sales.view"),
  asyncHandler(async (req, res) => {
    const data = await getCustomerCheckoutContext(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);

customerRoutes.patch(
  "/customers/:id",
  requireAuth,
  requirePermission("customers.create"),
  asyncHandler(async (req, res) => {
    const data = await updateCustomer(req.auth!, String(req.params.id), req.body);
    res.json({ success: true, data });
  }),
);
