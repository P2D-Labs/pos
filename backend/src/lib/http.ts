import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function errorMiddleware(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.details ?? null,
    });
    return;
  }

  if (env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[HTTP 500]", error.name, error.message, error.stack);
  }

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production" ? "Internal server error" : error.message || "Internal server error",
    ...(env.NODE_ENV !== "production" && { name: error.name }),
  });
}
