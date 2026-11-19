import type { Response } from "express";

/**
 * Every JSON response uses the same envelope:
 *   { success: true,  data, message?, meta? }
 *   { success: false, message, errors? }
 *
 * Both the client API layer and the error middleware depend on this shape.
 */
export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  totalRevenue?: number;
  [key: string]: unknown;
}

export interface SuccessEnvelope<T> {
  success: true;
  data?: T;
  message?: string;
  meta?: ApiMeta;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface SendSuccessOptions {
  message?: string;
  meta?: ApiMeta;
  status?: number;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  options: SendSuccessOptions = {}
): Response {
  const body: SuccessEnvelope<T> = { success: true };
  if (data !== undefined) body.data = data;
  if (options.message) body.message = options.message;
  if (options.meta) body.meta = options.meta;
  return res.status(options.status ?? 200).json(body);
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  errors?: Record<string, string[]>
): Response {
  const body: ErrorEnvelope = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

export function paginatedMeta(
  total: number,
  page: number,
  limit: number
): ApiMeta {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
