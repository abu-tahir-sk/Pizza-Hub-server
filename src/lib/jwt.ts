import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * PizzaHub issues JWTs signed with the same secret as Better Auth
 * (HS256) so the Express middleware and the auth layer stay in sync.
 * The token is never stored in localStorage — the client keeps it in
 * memory and sends it via the `Authorization` header.
 */
export interface PizzaHubTokenPayload {
  sub: string;
  email: string;
  role: "vendor" | "customer" | "admin";
}

export function signJwt(
  payload: PizzaHubTokenPayload,
  expiresIn: jwt.SignOptions["expiresIn"] = "7d"
): string {
  // HS256 is the default algorithm for string secrets
  return jwt.sign(payload, env.BETTER_AUTH_SECRET, { expiresIn });
}

export function verifyJwt(token: string): PizzaHubTokenPayload {
  return jwt.verify(token, env.BETTER_AUTH_SECRET, {
    algorithms: ["HS256"],
  }) as PizzaHubTokenPayload;
}
