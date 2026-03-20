import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  businessSettingsUpdateSchema,
  customizationSettingsSchema,
} from "../models/settings.model";
import {
  getCustomizationSettings,
  updateBusinessSettings,
  updateCustomizationSettings,
} from "../services/settings.service";

export const settingsRoutes = Router();

settingsRoutes.post(
  "/settings/business",
  requireAuth,
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const input = businessSettingsUpdateSchema.parse(req.body);
    const data = await updateBusinessSettings(req.auth!, input);
    res.json({ success: true, data });
  }),
);

settingsRoutes.post(
  "/settings/customization",
  requireAuth,
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const input = customizationSettingsSchema.parse(req.body);
    const data = await updateCustomizationSettings(req.auth!, input);
    res.json({ success: true, data });
  }),
);

settingsRoutes.get(
  "/settings/customization",
  requireAuth,
  requirePermission("settings.view"),
  asyncHandler(async (req, res) => {
    const data = await getCustomizationSettings(req.auth!);
    res.json({ success: true, data });
  }),
);
