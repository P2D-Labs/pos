import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  businessSetupSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
} from "../models/auth.model";
import {
  forgotPassword,
  login,
  listSessions,
  logout,
  logoutAll,
  refresh,
  resetPassword,
  revokeSession,
  setupBusiness,
} from "../services/auth.service";

export const authRoutes = Router();

authRoutes.post(
  "/auth/setup",
  asyncHandler(async (req, res) => {
    const input = businessSetupSchema.parse(req.body);
    const data = await setupBusiness(input);
    res.status(201).json({ success: true, data });
  }),
);

authRoutes.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const data = await login(input);
    res.json({ success: true, data });
  }),
);

authRoutes.post(
  "/auth/refresh",
  asyncHandler(async (req, res) => {
    const input = refreshSchema.parse(req.body);
    const data = await refresh(input);
    res.json({ success: true, data });
  }),
);

authRoutes.post(
  "/auth/logout",
  asyncHandler(async (req, res) => {
    const input = refreshSchema.parse(req.body);
    const data = await logout(input);
    res.json({ success: true, data });
  }),
);

authRoutes.post(
  "/auth/logout-all",
  requireAuth,
  requirePermission("sessions.manage"),
  asyncHandler(async (req, res) => {
    const data = await logoutAll(req.auth!.sub);
    res.json({ success: true, data });
  }),
);

authRoutes.get(
  "/auth/sessions",
  requireAuth,
  requirePermission("sessions.view"),
  asyncHandler(async (req, res) => {
    const data = await listSessions(req.auth!.sub, req.query);
    res.json({ success: true, data });
  }),
);

authRoutes.delete(
  "/auth/sessions/:tokenId",
  requireAuth,
  requirePermission("sessions.manage"),
  asyncHandler(async (req, res) => {
    const data = await revokeSession(req.auth!.sub, String(req.params.tokenId));
    res.json({ success: true, data });
  }),
);

authRoutes.post(
  "/auth/forgot-password",
  asyncHandler(async (req, res) => {
    const input = forgotPasswordSchema.parse(req.body);
    const data = await forgotPassword(input);
    res.json({ success: true, data });
  }),
);

authRoutes.post(
  "/auth/reset-password",
  asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const data = await resetPassword(input);
    res.json({ success: true, data });
  }),
);
