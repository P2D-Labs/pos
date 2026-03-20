import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import { quotationCreateSchema } from "../models/quotation.model";
import {
  convertQuotationToInvoice,
  createQuotation,
  listQuotations,
} from "../services/quotation.service";

export const quotationRoutes = Router();

quotationRoutes.get(
  "/quotations",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("quotations"),
  asyncHandler(async (req, res) => {
    const data = await listQuotations(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

quotationRoutes.post(
  "/quotations",
  requireAuth,
  requirePermission("sales.create"),
  requireModuleEnabled("quotations"),
  asyncHandler(async (req, res) => {
    const input = quotationCreateSchema.parse(req.body);
    const data = await createQuotation(req.auth!, input);
    res.status(201).json({ success: true, data });
  }),
);

quotationRoutes.post(
  "/quotations/:id/convert-to-invoice",
  requireAuth,
  requirePermission("sales.create"),
  requireModuleEnabled("quotations"),
  asyncHandler(async (req, res) => {
    const data = await convertQuotationToInvoice(req.auth!, String(req.params.id));
    res.status(201).json({ success: true, data });
  }),
);
