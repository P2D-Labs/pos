import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { salesInvoiceCreateSchema } from "../models/sales-invoice.model";
import {
  createSalesInvoice,
  getReturnableItems,
  getSalesInvoice,
  listSalesInvoices,
} from "../services/sales-invoice.service";

export const salesInvoiceRoutes = Router();

salesInvoiceRoutes.get(
  "/sales-invoices",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("salesInvoices"),
  asyncHandler(async (req, res) => {
    const documentTaxMode = req.query.documentTaxMode as "TAX" | "NON_TAX" | undefined;
    const data = await listSalesInvoices(req.auth!, documentTaxMode, req.query);
    res.json({ success: true, data });
  }),
);

salesInvoiceRoutes.post(
  "/sales-invoices",
  requireAuth,
  requirePermission("sales.create"),
  requireModuleEnabled("salesInvoices"),
  asyncHandler(async (req, res) => {
    const input = salesInvoiceCreateSchema.parse(req.body);
    const data = await createSalesInvoice(req.auth!, input);
    res.status(201).json({ success: true, data });
  }),
);

salesInvoiceRoutes.get(
  "/sales-invoices/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("salesInvoices"),
  asyncHandler(async (req, res) => {
    const data = await getSalesInvoice(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);

salesInvoiceRoutes.get(
  "/sales-invoices/:id/returnable-items",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("salesInvoices"),
  asyncHandler(async (req, res) => {
    const data = await getReturnableItems(req.auth!, String(req.params.id));
    res.json({ success: true, data });
  }),
);
