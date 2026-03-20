import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";

function getToggleValue(moduleToggles: unknown, moduleKey: string): boolean | undefined {
  if (!moduleToggles || typeof moduleToggles !== "object" || Array.isArray(moduleToggles)) {
    return undefined;
  }
  const value = (moduleToggles as Record<string, unknown>)[moduleKey];
  return typeof value === "boolean" ? value : undefined;
}

export function requireModuleEnabled(moduleKey: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.businessId) {
      throw new HttpError(401, "Unauthorized");
    }

    const settings = await prisma.businessSettings.findUnique({
      where: { id: `${req.auth.businessId}-settings` },
      select: { moduleToggles: true },
    });

    const enabled = getToggleValue(settings?.moduleToggles, moduleKey);
    if (enabled === false) {
      throw new HttpError(403, `${moduleKey} module is disabled`);
    }
    next();
  };
}
