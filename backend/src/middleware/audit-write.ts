import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

function sanitizeBody(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const clone = { ...(body as Record<string, unknown>) };
  if ("password" in clone) clone.password = "***";
  if ("adminPassword" in clone) clone.adminPassword = "***";
  if ("refreshToken" in clone) clone.refreshToken = "***";
  return clone;
}

export function auditWriteMiddleware(req: Request, res: Response, next: NextFunction) {
  const shouldTrackMethod = req.method === "POST" || req.method === "PATCH" || req.method === "DELETE";
  if (!shouldTrackMethod) {
    next();
    return;
  }

  res.on("finish", () => {
    if (!req.auth?.businessId || !req.auth.sub) return;
    if (res.statusCode >= 400) return;
    void prisma.auditLog.create({
      data: {
        businessId: req.auth.businessId,
        userId: req.auth.sub,
        action: `${req.method} ${req.path}`,
        entityType: "API_ROUTE",
        entityId: req.path,
        after: sanitizeBody(req.body) as Prisma.InputJsonValue,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });
  });

  next();
}
