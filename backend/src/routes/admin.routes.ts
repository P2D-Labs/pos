import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModuleEnabled } from "../middleware/module-toggle";
import {
  categorySchema,
  nameSchema,
  numberingSchema,
  paymentSchema,
  refundSchema,
  roleSchema,
  roleUpdateSchema,
  subCategorySchema,
  taxRateSchema,
  unitSchema,
  userSchema,
  userUpdateSchema,
} from "../models/admin.model";
import {
  createRole,
  deleteRole,
  deleteUser,
  createUser,
  getBusinessMe,
  listAuditLogs,
  listLedger,
  listRolesWithQuery,
  listStockTransactions,
  listUsersWithQuery,
  simpleCreate,
  simpleDelete,
  simpleListWithQuery,
  simpleUpdate,
  updateRole,
  updateUser,
  updateNumbering,
} from "../services/admin.service";
import { suggestedPermissions } from "../constants/permissions";
import { customerInvoicePaymentBatchSchema } from "../models/finance.model";
import { createCustomerInvoicePaymentBatch, createPayment, createRefund, listPayments, listRefunds } from "../services/finance.service";
import { getDashboardReport } from "../services/report.service";

export const adminRoutes = Router();

adminRoutes.get("/permissions/suggestions", requireAuth, requirePermission("roles.view"), asyncHandler(async (_req, res) => {
  res.json({ success: true, data: suggestedPermissions });
}));

adminRoutes.get("/business/me", requireAuth, requirePermission("business.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getBusinessMe(req.auth!) });
}));

adminRoutes.get("/business/dashboard", requireAuth, requirePermission("business.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getDashboardReport(req.auth!, req.query) });
}));

adminRoutes.get("/roles", requireAuth, requirePermission("roles.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listRolesWithQuery(req.auth!, req.query) });
}));

adminRoutes.post("/roles", requireAuth, requirePermission("roles.create"), asyncHandler(async (req, res) => {
  const input = roleSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createRole(req.auth!, input) });
}));
adminRoutes.patch("/roles/:id", requireAuth, requirePermission("roles.create"), asyncHandler(async (req, res) => {
  const input = roleUpdateSchema.parse(req.body);
  const roleId = String(req.params.id);
  res.json({ success: true, data: await updateRole(req.auth!, roleId, input) });
}));
adminRoutes.delete("/roles/:id", requireAuth, requirePermission("roles.create"), asyncHandler(async (req, res) => {
  const roleId = String(req.params.id);
  res.json({ success: true, data: await deleteRole(req.auth!, roleId) });
}));

adminRoutes.get("/users", requireAuth, requirePermission("users.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listUsersWithQuery(req.auth!, req.query) });
}));

adminRoutes.post("/users", requireAuth, requirePermission("users.create"), asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createUser(req.auth!, input) });
}));
adminRoutes.patch("/users/:id", requireAuth, requirePermission("users.create"), asyncHandler(async (req, res) => {
  const input = userUpdateSchema.parse(req.body);
  const userId = String(req.params.id);
  res.json({ success: true, data: await updateUser(req.auth!, userId, input) });
}));
adminRoutes.delete("/users/:id", requireAuth, requirePermission("users.create"), asyncHandler(async (req, res) => {
  const userId = String(req.params.id);
  res.json({ success: true, data: await deleteUser(req.auth!, userId) });
}));

adminRoutes.get("/units", requireAuth, requirePermission("units.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("unit", req.auth!, req.query) });
}));
adminRoutes.post("/units", requireAuth, requirePermission("units.create"), asyncHandler(async (req, res) => {
  const input = unitSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("unit", req.auth!, input) });
}));
adminRoutes.patch("/units/:id", requireAuth, requirePermission("units.create"), asyncHandler(async (req, res) => {
  const input = unitSchema.partial().parse(req.body);
  res.json({ success: true, data: await simpleUpdate("unit", req.auth!, String(req.params.id), input) });
}));
adminRoutes.delete("/units/:id", requireAuth, requirePermission("units.create"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleDelete("unit", req.auth!, String(req.params.id)) });
}));

adminRoutes.get("/categories", requireAuth, requirePermission("categories.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("category", req.auth!, req.query) });
}));
adminRoutes.post("/categories", requireAuth, requirePermission("categories.create"), asyncHandler(async (req, res) => {
  const input = categorySchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("category", req.auth!, input) });
}));
adminRoutes.patch("/categories/:id", requireAuth, requirePermission("categories.create"), asyncHandler(async (req, res) => {
  const input = categorySchema.partial().parse(req.body);
  res.json({ success: true, data: await simpleUpdate("category", req.auth!, String(req.params.id), input) });
}));
adminRoutes.delete("/categories/:id", requireAuth, requirePermission("categories.create"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleDelete("category", req.auth!, String(req.params.id)) });
}));

adminRoutes.get("/subcategories", requireAuth, requirePermission("subcategories.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("subCategory", req.auth!, req.query) });
}));
adminRoutes.post("/subcategories", requireAuth, requirePermission("subcategories.create"), asyncHandler(async (req, res) => {
  const input = subCategorySchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("subCategory", req.auth!, input) });
}));
adminRoutes.patch("/subcategories/:id", requireAuth, requirePermission("subcategories.create"), asyncHandler(async (req, res) => {
  const input = subCategorySchema.partial().parse(req.body);
  res.json({ success: true, data: await simpleUpdate("subCategory", req.auth!, String(req.params.id), input) });
}));
adminRoutes.delete("/subcategories/:id", requireAuth, requirePermission("subcategories.create"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleDelete("subCategory", req.auth!, String(req.params.id)) });
}));

adminRoutes.get("/brands", requireAuth, requirePermission("brands.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("brand", req.auth!, req.query) });
}));
adminRoutes.post("/brands", requireAuth, requirePermission("brands.create"), asyncHandler(async (req, res) => {
  const input = nameSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("brand", req.auth!, input) });
}));
adminRoutes.patch("/brands/:id", requireAuth, requirePermission("brands.create"), asyncHandler(async (req, res) => {
  const input = nameSchema.partial().parse(req.body);
  res.json({ success: true, data: await simpleUpdate("brand", req.auth!, String(req.params.id), input) });
}));
adminRoutes.delete("/brands/:id", requireAuth, requirePermission("brands.create"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleDelete("brand", req.auth!, String(req.params.id)) });
}));

adminRoutes.get("/tax-rates", requireAuth, requirePermission("taxRates.view"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleListWithQuery("taxRate", req.auth!, req.query) });
}));
adminRoutes.post("/tax-rates", requireAuth, requirePermission("taxRates.create"), asyncHandler(async (req, res) => {
  const input = taxRateSchema.parse(req.body);
  res.status(201).json({ success: true, data: await simpleCreate("taxRate", req.auth!, input) });
}));
adminRoutes.patch("/tax-rates/:id", requireAuth, requirePermission("taxRates.create"), asyncHandler(async (req, res) => {
  const input = taxRateSchema.partial().parse(req.body);
  res.json({ success: true, data: await simpleUpdate("taxRate", req.auth!, String(req.params.id), input) });
}));
adminRoutes.delete("/tax-rates/:id", requireAuth, requirePermission("taxRates.create"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await simpleDelete("taxRate", req.auth!, String(req.params.id)) });
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

adminRoutes.post(
  "/payments/customer-invoice-batch",
  requireAuth,
  requirePermission("payments.create"),
  requireModuleEnabled("payments"),
  asyncHandler(async (req, res) => {
    const input = customerInvoicePaymentBatchSchema.parse(req.body);
    res.status(201).json({ success: true, data: await createCustomerInvoicePaymentBatch(req.auth!, input) });
  }),
);

adminRoutes.post("/payments", requireAuth, requirePermission("payments.create"), requireModuleEnabled("payments"), asyncHandler(async (req, res) => {
  const input = paymentSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createPayment(req.auth!, input) });
}));
adminRoutes.get("/payments", requireAuth, requirePermission("payments.view"), requireModuleEnabled("payments"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listPayments(req.auth!, req.query) });
}));

adminRoutes.post("/refunds", requireAuth, requirePermission("refunds.create"), requireModuleEnabled("salesReturns"), asyncHandler(async (req, res) => {
  const input = refundSchema.parse(req.body);
  res.status(201).json({ success: true, data: await createRefund(req.auth!, input) });
}));
adminRoutes.get("/refunds", requireAuth, requirePermission("refunds.view"), requireModuleEnabled("salesReturns"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listRefunds(req.auth!, req.query) });
}));
