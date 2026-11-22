import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProd } from "../config/env.js";
import { sendError } from "../utils/api-response.js";

/** Application error with an explicit HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

type MongoErrorShape = {
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
  name?: string;
  errors?: Record<string, { message: string }>;
};

/**
 * Single place that turns any thrown value into the standard error envelope.
 * No stack traces or raw provider details are ever sent to clients.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    sendError(res, err.status, err.message);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 400, "Validation failed", err.flatten().fieldErrors as Record<string, string[]>);
    return;
  }

  if (err instanceof Error && err.name === "MulterError") {
    const code = (err as Error & { code?: string }).code;
    const message = code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : "Invalid upload";
    sendError(res, 413, message);
    return;
  }

  const mongoErr = err as MongoErrorShape | null;
  if (mongoErr && typeof mongoErr === "object" && mongoErr.code === 11000) {
    const field = Object.keys(mongoErr.keyPattern ?? mongoErr.keyValue ?? {})[0];
    sendError(
      res,
      409,
      field
        ? `A record with this ${field} already exists`
        : "Duplicate record — a record with this value already exists"
    );
    return;
  }

  if (mongoErr && typeof mongoErr === "object" && mongoErr.name === "CastError") {
    sendError(res, 400, "Invalid ID format");
    return;
  }

  if (mongoErr && typeof mongoErr === "object" && mongoErr.name === "ValidationError") {
    const errors: Record<string, string[]> = Object.fromEntries(
      Object.entries(mongoErr.errors ?? {}).map(([key, value]) => [key, [value.message]])
    );
    sendError(res, 400, "Validation failed", errors);
    return;
  }

  // Stripe and other provider errors: log detail, return a safe message.
  const providerError = err as Error & { type?: string };
  if (
    providerError instanceof Error &&
    typeof providerError.type === "string" &&
    providerError.type.startsWith("Stripe")
  ) {
    if (!isProd) console.error("Payment provider error:", providerError.message);
    sendError(res, 502, "Payment provider error");
    return;
  }

  console.error(
    "Unhandled error:",
    err instanceof Error ? err.stack || err.message : err
  );
  sendError(res, 500, err instanceof Error ? err.message : "Internal server error");
}
