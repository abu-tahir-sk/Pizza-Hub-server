import "dotenv/config";
import { z } from "zod";

/**
 * All environment access is centralized here. Nothing else in the app reads
 * process.env directly. Values are validated once at startup and the parsed,
 * typed result is exported as `env`.
 *
 * Never log or return these values — `env` is server-only.
 */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Comma-separated allowlist. CLIENT_URL is always included.
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  ADDITIONAL_CLIENT_URLS: z.string().optional().default(""),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("pizzahub"),

  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:5000"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PREMIUM_PRICE_ID: z.string().optional().default(""),

  IMGBB_API_KEY: z.string().optional().default(""),

  ADMIN_NAME: z.string().default("Platform Admin"),
  ADMIN_EMAIL: z.string().default("admin@pizzahub.com"),
  ADMIN_PASSWORD: z.string().default("Admin123"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Only field names and messages are printed — never the values themselves.
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

/** Non-fatal production checks. Safe to call once during startup. */
export function warnOnInsecureProductionConfig(): void {
  if (!isProd) return;

  const warnings: string[] = [];
  if (env.CLIENT_URL.includes("localhost")) {
    warnings.push("CLIENT_URL still points to localhost");
  }
  if (env.ADMIN_PASSWORD === "Admin123") {
    warnings.push("ADMIN_PASSWORD is still the default value");
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    warnings.push("Stripe is not fully configured — premium payments will be unavailable");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    warnings.push("Google OAuth is not configured — social sign-in will be unavailable");
  }
  if (!env.IMGBB_API_KEY) {
    warnings.push("IMGBB_API_KEY is not configured — image uploads will be unavailable");
  }

  for (const warning of warnings) console.warn(`Production config warning: ${warning}`);
}
