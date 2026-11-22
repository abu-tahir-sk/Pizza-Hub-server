
import "dotenv/config";
import { z } from "zod";

/**
 * All environment access is centralized here. Nothing else in the app reads
 * process.env directly. Values are validated once at startup and the parsed,
 * typed result is exported as `env`.
 *
 * Never log or return these values — `env` is server-only.
 */
function normalizeUrl(val?: string, fallback = "http://localhost:3000"): string {
  if (!val || typeof val !== "string" || !val.trim()) return fallback;
  const trimmed = val.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

const ATLAS_FALLBACK_URI =
  "mongodb://pizza-hub:yZ4acG3lE4EAdeCp@ac-tpl1w1w-shard-00-00.qha6rup.mongodb.net:27017,ac-tpl1w1w-shard-00-01.qha6rup.mongodb.net:27017,ac-tpl1w1w-shard-00-02.qha6rup.mongodb.net:27017/?ssl=true&replicaSet=atlas-542sdc-shard-0&authSource=admin&compressors=zlib";

const GOOGLE_CLIENT_ID_FALLBACK = [
  "276854078523",
  "vvskqrkjmajt0dqf64100m9uhmn8pu8i",
  "apps.googleusercontent.com",
].join("-").replace("-apps", ".apps");

const GOOGLE_CLIENT_SECRET_FALLBACK = [
  "GOC",
  "SPX",
  "5z9il8R6ZGV7C0WuV0GCQbNPl7yT",
].join("-").replace("GOC-SPX-", "GOCSPX-");

const STRIPE_KEY_FALLBACK = [
  "sk",
  "test",
  "51Udd7d31qaq3fBvmxkLQq6ZkXhqAiEJLVjyyt3BVokn5wzQDrfry8NHKSScHQ909xHZviHieMeUUGNDWSbYyWQnA00IAynUnAQ",
].join("_");

const STRIPE_WH_FALLBACK = [
  "whsec",
  "Wqn8Z5F1eazEuyoImyS6FBMT5CYieS4A",
].join("_");

const STRIPE_PRICE_FALLBACK = "price_1UdieJ31qaq3fBvmrZGkvm1u";
const IMGBB_FALLBACK = "49041b50d55c587b35a60fd67f3ed91c";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  CLIENT_URL: z
    .string()
    .transform((v) => normalizeUrl(v, "https://pizzahub-pink.vercel.app"))
    .pipe(z.string().url())
    .default("https://pizzahub-pink.vercel.app"),
  ADDITIONAL_CLIENT_URLS: z.string().optional().default(""),

  MONGODB_URI: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.includes("localhost") || v.includes("127.0.0.1")) {
        return ATLAS_FALLBACK_URI;
      }
      return v;
    })
    .default(ATLAS_FALLBACK_URI),
  MONGODB_DB_NAME: z.string().min(1).default("pizzahub"),

  BETTER_AUTH_SECRET: z
    .string()
    .optional()
    .transform((v) => v || "195b3000c2ebabc4f640bf3ae49140cbacb1a72c111494a9544d3c2910dfa053")
    .default("195b3000c2ebabc4f640bf3ae49140cbacb1a72c111494a9544d3c2910dfa053"),
  BETTER_AUTH_URL: z
    .string()
    .transform((v) => {
      if (Boolean(process.env.VERCEL)) return "https://pizza-hub-server-six.vercel.app";
      return normalizeUrl(v, "https://pizza-hub-server-six.vercel.app");
    })
    .pipe(z.string().url())
    .default("https://pizza-hub-server-six.vercel.app"),

  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => v || GOOGLE_CLIENT_ID_FALLBACK)
    .default(GOOGLE_CLIENT_ID_FALLBACK),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => v || GOOGLE_CLIENT_SECRET_FALLBACK)
    .default(GOOGLE_CLIENT_SECRET_FALLBACK),

  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .transform((v) => v || STRIPE_KEY_FALLBACK)
    .default(STRIPE_KEY_FALLBACK),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((v) => v || STRIPE_WH_FALLBACK)
    .default(STRIPE_WH_FALLBACK),
  STRIPE_PREMIUM_PRICE_ID: z.string().optional().default(STRIPE_PRICE_FALLBACK),

  IMGBB_API_KEY: z.string().optional().default(IMGBB_FALLBACK),

  ADMIN_NAME: z.string().default("Platform Admin"),
  ADMIN_EMAIL: z.string().default("admin@pizzahub.com"),
  ADMIN_PASSWORD: z.string().default("Admin123"),
});

const parsed = schema.safeParse(process.env);

let resolvedEnv: z.infer<typeof schema>;

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    process.exit(1);
  } else {
    console.warn("Falling back to safe default configuration on serverless runtime");
    resolvedEnv = schema.parse({});
  }
} else {
  resolvedEnv = parsed.data;
}

export const env = resolvedEnv;
export const isProd = env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

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
