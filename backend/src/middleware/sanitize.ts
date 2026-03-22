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
  // JSON bodies (login, etc.)
  req.body = sanitizeValue(req.body);
  // Express 5: `req.query` is read-only (getter); assigning throws.
  // This middleware runs before route matching, so `req.params` is not populated yet anyway.
  // Add route-level sanitization if you need to strip HTML from query/path params.
  next();
}
