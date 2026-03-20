import { NextFunction, Request, Response } from "express";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/<script.*?>.*?<\/script>/gi, "")
      .replace(/[<>]/g, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      cleaned[key] = sanitizeValue(source[key]);
    }
    return cleaned;
  }
  return value;
}

export function sanitizeRequestMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query) as Request["query"];
  req.params = sanitizeValue(req.params) as Request["params"];
  next();
}
