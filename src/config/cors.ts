import type { CorsOptions } from "cors";
import { env } from "./env.js";

/**
 * CORS allowlist. The production frontend domain comes from CLIENT_URL;
 * additional domains can be supplied via ADDITIONAL_CLIENT_URLS (comma
 * separated). Credentials are enabled because Better Auth uses cookies.
 *
 * Requests without an Origin header (health checks, server-to-server calls,
 * Stripe webhooks) are allowed through — the browser is the only place CORS
 * is enforced.
 */
function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set<string>();
const configured = [env.CLIENT_URL, ...env.ADDITIONAL_CLIENT_URLS.split(",")];
for (const entry of configured) {
  const origin = normalizeOrigin(entry);
  if (origin) allowedOrigins.add(origin);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.has(origin) ||
      origin.endsWith(".vercel.app") ||
      origin.includes("pizzahub") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      return callback(null, true);
    }
    // Returning false omits ACAO headers, so the browser blocks the request.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
};

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.has(origin);
}
