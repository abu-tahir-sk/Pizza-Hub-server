import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps async Express handlers so rejected promises reach the centralized
 * error middleware. Keeps controllers free of repetitive try/catch blocks.
 */
export function asyncRoute<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => unknown | Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as T, res, next)).catch(next);
  };
}
