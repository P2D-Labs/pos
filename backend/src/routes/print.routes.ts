import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import {
  generateInvoicePdf,
  generateInvoicePdfHtml,
  generatePurchasePdf,
  generateQuotationPdf,
  generateSalesReturnPdf,
  generateThermalReceipt,
  printPurchase,
  printQuotation,
  printSalesInvoice,
  printSalesReturn,
  reprintSearch,
} from "../services/print.service";

export const printRoutes = Router();

printRoutes.get(
  "/print/sales-invoices/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await printSalesInvoice(req.auth!, String(req.params.id));
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/sales-returns/:id",
  requireAuth,
  requirePermission("returns.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await printSalesReturn(req.auth!, String(req.params.id));
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.post(
  "/sales-returns/:id/print",
  requireAuth,
  requirePermission("returns.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await printSalesReturn(req.auth!, String(req.params.id));
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/quotations/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await printQuotation(req.auth!, String(req.params.id));
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/purchases/:id",
  requireAuth,
  requirePermission("purchases.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await printPurchase(req.auth!, String(req.params.id));
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/reprint-search",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const data = await reprintSearch(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

printRoutes.get(
  "/print/thermal-receipt/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await generateThermalReceipt(req.auth!, String(req.params.id));
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/a4-tax-invoice/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await generateInvoicePdfHtml(req.auth!, String(req.params.id), "TAX");
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/pdf/a4-tax-invoice/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const pdf = await generateInvoicePdf(req.auth!, String(req.params.id), "TAX");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="tax-invoice-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);

printRoutes.get(
  "/print/a4-non-tax-invoice/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const html = await generateInvoicePdfHtml(req.auth!, String(req.params.id), "NON_TAX");
    res.json({ success: true, data: { html } });
  }),
);

printRoutes.get(
  "/print/pdf/a4-non-tax-invoice/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const pdf = await generateInvoicePdf(req.auth!, String(req.params.id), "NON_TAX");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="non-tax-invoice-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);

printRoutes.get(
  "/print/pdf/quotations/:id",
  requireAuth,
  requirePermission("sales.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const pdf = await generateQuotationPdf(req.auth!, String(req.params.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="quotation-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);

printRoutes.get(
  "/print/pdf/sales-returns/:id",
  requireAuth,
  requirePermission("returns.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const pdf = await generateSalesReturnPdf(req.auth!, String(req.params.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="sales-return-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);

printRoutes.get(
  "/print/pdf/purchases/:id",
  requireAuth,
  requirePermission("purchases.view"),
  requireModuleEnabled("printCenter"),
  asyncHandler(async (req, res) => {
    const pdf = await generatePurchasePdf(req.auth!, String(req.params.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="purchase-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);
