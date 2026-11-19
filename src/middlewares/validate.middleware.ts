import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Zod-backed request validation.
 *
 * - `body` and `params` are replaced with the parsed values so controllers
 *   receive fully typed/coerced input.
 * - `query` is validated and stored in `res.locals.validatedQuery` because
 *   Express 5 exposes `req.query` as a read-only getter.
 *
 * Failures are forwarded to the centralized error middleware (HTTP 400).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params) as object);
      }
      if (schemas.query) {
        res.locals.validatedQuery = schemas.query.parse(req.query);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validatedQuery<T>(res: {
  locals: Record<string, unknown>;
}): T | undefined {
  return res.locals.validatedQuery as T | undefined;
}
