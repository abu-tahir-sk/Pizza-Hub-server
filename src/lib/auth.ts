import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { env, isProd } from "../config/env.js";
import { mongoClient, authDb } from "./mongo-client.js";

/**
 * In production or remote deployments, Better Auth's baseURL MUST be the server's
 * own origin (where /api/auth/* lives), NOT the client's origin. If BETTER_AUTH_URL
 * was mistakenly set to the client URL or is pointing to localhost while running
 * on Vercel, we automatically use the server's canonical origin.
 */
function resolveAuthBaseUrl(): string {
  if (isProd || Boolean(process.env.VERCEL)) {
    const raw = env.BETTER_AUTH_URL;
    if (
      raw &&
      !raw.includes("localhost") &&
      !raw.includes("127.0.0.1") &&
      !raw.includes("pizzahub-pink.vercel.app")
    ) {
      return raw;
    }
    return "https://pizza-hub-server-theta.vercel.app";
  }
  return env.BETTER_AUTH_URL;
}

const authBaseUrl = resolveAuthBaseUrl();

/**
 * The client and API are deployed on different origins. In production the
 * session cookie must therefore be cross-site capable (`SameSite=None` +
 * `Secure`) or browsers will drop it and every reload looks logged-out.
 */
const secureCookies =
  authBaseUrl.startsWith("https://") ||
  isProd ||
  Boolean(process.env.VERCEL);

/**
 * Better Auth owns the `user`, `session`, `account` and `verification`
 * collections. Business fields live on the user document via additionalFields
 * and are never writable by the client (no profile endpoint changes them).
 */
export const auth = betterAuth({
  appName: "PizzaHub",
  baseURL: authBaseUrl,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: Array.from(
    new Set([
      env.CLIENT_URL,
      "https://pizzahub-pink.vercel.app",
      "https://pizza-hub-server-theta.vercel.app",
      "http://localhost:3000",
      "http://localhost:5000",
      ...env.ADDITIONAL_CLIENT_URLS.split(",").map((s) => s.trim()).filter(Boolean),
    ])
  ),
  onAPIError: {
    throw: true,
    errorURL: `${env.CLIENT_URL}/sign-in`,
    onError: async (error) => {
      console.error("Better Auth API error:", error);
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
    },
    skipStateCookieCheck: true,
  },
  database: mongodbAdapter(authDb, {
    client: mongoClient,
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  socialProviders: env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: true, // signup can request vendor/customer; admin is assigned via seed only
      },
      isBlocked: { type: "boolean", required: false, defaultValue: false, input: false },
      businessName: { type: "string", required: false, defaultValue: null, input: true },
      subscriptionPlan: { type: "string", required: false, defaultValue: "free", input: false },
      subscriptionExpiresAt: { type: "date", required: false, defaultValue: null, input: false },
    },
  },
  session: {
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    cookiePrefix: "pizzahub",
    useSecureCookies: secureCookies,
    defaultCookieAttributes: {
      sameSite: secureCookies ? "none" : "lax",
      secure: secureCookies,
      httpOnly: true,
      path: "/",
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          // Safety net: admin role can never be requested through public signup.
          const bodyRole = ctx?.body?.role;
          const requestedRole = bodyRole === "vendor" ? "vendor" : "customer";
          return {
            data: {
              ...user,
              role: requestedRole,
              businessName: requestedRole === "vendor" ? (ctx?.body?.businessName ?? null) : null,
            },
          };
        },
      },
      update: {
        before: async (data) => {
          // Never allow privilege fields to be changed through Better Auth's
          // public /update-user endpoint, even if a client sends them directly.
          const safe = { ...(data as Record<string, unknown>) };
          delete safe.role;
          delete safe.isBlocked;
          delete safe.subscriptionPlan;
          delete safe.subscriptionExpiresAt;
          return { data: safe };
        },
      },
    },
  },
  plugins: [],
});

export type Auth = typeof auth;
