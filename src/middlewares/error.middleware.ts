import mongoose from "mongoose";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  // Mongoose duplicate key
  if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate record — this order already exists" });
  }

  // Mongoose cast / validation errors
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = (err as { name: string }).name;
    if (name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    if (name === "ValidationError") {
      const ve = err as unknown as { errors: Record<string, { message: string }> };
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.fromEntries(Object.entries(ve.errors ?? {}).map(([k, v]) => [k, v.message])),
      });
    }
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
}
