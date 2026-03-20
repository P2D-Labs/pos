import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import {
  expenseSchema,
  nameSchema,
  numberingSchema,
  paymentSchema,
  refundSchema,
  roleSchema,
  taxRateSchema,
  unitSchema,
  userSchema,
} from "../models/admin.model";
import {
  createRole,
  suggestedPermissions,
  createUser,
  getBusinessMe,
  listAuditLogs,
  listLedger,
  listRolesWithQuery,
  listStockTransactions,
  listUsersWithQuery,
  simpleCreate,
  simpleListWithQuery,
  updateNumbering,
} from "../services/admin.service";
import {
  createExpense,
  createPayment,
  createRefund,
  listExpenses,
  listPayments,
  listRefunds,
} from "../services/finance.service";
import { getDashboardReport } from "../services/report.service";

export const adminRoutes = Router();

adminRoutes.get("/permissions/suggestions", requireAuth, requirePermission("roles.view"), asyncHandler(async (_req, res) => {
  res.json({ success: true, data: suggestedPermissions });
}));

adminRoutes.get("/business/me", requireAuth, requirePermission("business.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getBusinessMe(req.auth!) });
}));

adminRoutes.get("/business/dashboard", requireAuth, requirePermission("business.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getDashboardReport(req.auth!) });
}));

adminRoutes.get("/roles", requireAuth, requirePermission("roles.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listRolesWithQuery(req.auth!, req.query) });
}));

adminRoutes.post("/roles", requireAuth, requirePermission("roles.create"), asyncHandler(async (req, res) => {
  const input = roleSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createRole(req.auth!, input) });
}));

adminRoutes.get("/users", requireAuth, requirePermission("users.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listUsersWithQuery(req.auth!, req.query) });
}));

adminRoutes.post("/users", requireAuth, requirePermission("users.create"), asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createUser(req.auth!, input) });
}));

adminRoutes.get("/units", requireAuth, requirePermission("units.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("unit", req.auth!, req.query) });
}));
adminRoutes.post("/units", requireAuth, requirePermission("units.create"), asyncHandler(async (req, res) => {
  const input = unitSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("unit", req.auth!, input) });
}));

adminRoutes.get("/categories", requireAuth, requirePermission("categories.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("category", req.auth!, req.query) });
}));
adminRoutes.post("/categories", requireAuth, requirePermission("categories.create"), asyncHandler(async (req, res) => {
  const input = nameSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("category", req.auth!, input) });
}));

adminRoutes.get("/brands", requireAuth, requirePermission("brands.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("brand", req.auth!, req.query) });
}));
adminRoutes.post("/brands", requireAuth, requirePermission("brands.create"), asyncHandler(async (req, res) => {
  const input = nameSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("brand", req.auth!, input) });
}));

adminRoutes.get("/tax-rates", requireAuth, requirePermission("taxRates.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("taxRate", req.auth!, req.query) });
}));
adminRoutes.post("/tax-rates", requireAuth, requirePermission("taxRates.create"), asyncHandler(async (req, res) => {
  const input = taxRateSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("taxRate", req.auth!, input) });
}));

adminRoutes.patch("/settings/numbering", requireAuth, requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const input = numberingSchema.parse(req.body);
  res.json({ success: true, data: await updateNumbering(req.auth!, input) });
}));

adminRoutes.get("/audit-logs", requireAuth, requirePermission("audit.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listAuditLogs(req.auth!, req.query) });
}));

adminRoutes.get("/stock-transactions", requireAuth, requirePermission("inventory.view"), requireModuleEnabled("inventory"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listStockTransactions(req.auth!, req.query) });
}));

adminRoutes.get("/ledger", requireAuth, requirePermission("ledger.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listLedger(req.auth!, req.query) });
}));

adminRoutes.post("/payments", requireAuth, requirePermission("payments.create"), requireModuleEnabled("payments"), asyncHandler(async (req, res) => {
  const input = paymentSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createPayment(req.auth!, input) });
}));
adminRoutes.get("/payments", requireAuth, requirePermission("payments.view"), requireModuleEnabled("payments"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listPayments(req.auth!, req.query) });
}));

adminRoutes.post("/refunds", requireAuth, requirePermission("refunds.create"), requireModuleEnabled("refunds"), asyncHandler(async (req, res) => {
  const input = refundSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createRefund(req.auth!, input) });
}));
adminRoutes.get("/refunds", requireAuth, requirePermission("refunds.view"), requireModuleEnabled("refunds"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listRefunds(req.auth!, req.query) });
}));

adminRoutes.post("/expenses", requireAuth, requirePermission("expenses.create"), requireModuleEnabled("expenses"), asyncHandler(async (req, res) => {
  const input = expenseSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createExpense(req.auth!, input) });
}));
adminRoutes.get("/expenses", requireAuth, requirePermission("expenses.view"), requireModuleEnabled("expenses"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listExpenses(req.auth!, req.query) });
}));
