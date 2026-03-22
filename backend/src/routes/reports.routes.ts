import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import {
  getAuditReport,
  getDashboardReport,
  getDailySalesReport,
  getLowStockReport,
  getNonTaxSalesReport,
  getPayablesReport,
  getPurchasesBySupplierReport,
  getQuotationConversionReport,
  getReceivablesReport,
  getRefundsReport,
  getProfitSummaryReport,
  getSalesByCustomerReport,
  getSalesByItemReport,
  getSalesReturnsReport,
  getStockMovementReport,
  getStockSummaryReport,
  getTaxSalesReport,
  getUserActivityReport,
} from "../services/report.service";

export const reportRoutes = Router();

reportRoutes.get(
  "/reports/dashboard",
  requireAuth,
  requirePermission("reports.view"),
  requireModuleEnabled("reports"),
  asyncHandler(async (req, res) => {
    const data = await getDashboardReport(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

reportRoutes.get(
  "/reports/tax-sales",
  requireAuth,
  requirePermission("reports.view"),
  requireModuleEnabled("reports"),
  asyncHandler(async (req, res) => {
    const data = await getTaxSalesReport(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

reportRoutes.get(
  "/reports/non-tax-sales",
  requireAuth,
  requirePermission("reports.view"),
  requireModuleEnabled("reports"),
  asyncHandler(async (req, res) => {
    const data = await getNonTaxSalesReport(req.auth!, req.query);
    res.json({ success: true, data });
  }),
);

reportRoutes.get(
  "/reports/stock-summary",
  requireAuth,
  requirePermission("reports.view"),
  requireModuleEnabled("reports"),
  asyncHandler(async (req, res) => {
    const data = await getStockSummaryReport(req.auth!);
    res.json({ success: true, data });
  }),
);

reportRoutes.get("/reports/low-stock", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getLowStockReport(req.auth!) });
}));
reportRoutes.get("/reports/receivables", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getReceivablesReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/payables", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getPayablesReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/sales-returns", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getSalesReturnsReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/refunds", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getRefundsReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/audit", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getAuditReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/sales-by-item", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getSalesByItemReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/sales-by-customer", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getSalesByCustomerReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/purchases-by-supplier", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getPurchasesBySupplierReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/stock-movement", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getStockMovementReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/quotation-conversion", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getQuotationConversionReport(req.auth!, req.query) });
}));
reportRoutes.get("/reports/user-activity", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getUserActivityReport(req.auth!, req.query) });
}));

reportRoutes.get("/reports/daily-sales", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getDailySalesReport(req.auth!, req.query) });
}));

reportRoutes.get("/reports/profit-summary", requireAuth, requirePermission("reports.view"), requireModuleEnabled("reports"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getProfitSummaryReport(req.auth!, req.query) });
}));
