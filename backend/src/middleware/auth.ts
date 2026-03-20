import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../lib/http";

export type AuthUser = {
  sub: string;
  businessId: string;
  roleId: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    throw new HttpError(401, "Unauthorized");
  }

  try {
    req.auth = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    next();
  } catch {
    throw new HttpError(401, "Invalid token");
  }
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const permissions = req.auth?.permissions ?? [];
    if (!permissions.includes("*") && !permissions.includes(permission)) {
      throw new HttpError(403, "Forbidden");
    }
    next();
  };
}
