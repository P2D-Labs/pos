import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

export function auditMeta(req: Request, _res: Response, next: NextFunction) {
  req.headers["x-request-id"] = req.headers["x-request-id"] ?? crypto.randomUUID();
  next();
}
