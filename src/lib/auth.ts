import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { env } from "../config/env.js";
import { mongooseInstance } from "./db.js";

/**
 * Better Auth owns the `user`, `session`, `account` and `verification`
 * collections. Business fields live on the user document via additionalFields
 * and are never writable by the client (no profile endpoint changes them).
 */
export const auth = betterAuth({
  appName: "PizzaHub",
  baseURL: env.BETTER_AUTH_URL,
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
    errorURL: `${env.CLIENT_URL}/sign-in`,
  },
  database: mongodbAdapter(
    mongooseInstance.connection.useDb(env.MONGODB_DB_NAME) as unknown as mongoose.mongo.Db,
    { transaction: false }
  ),
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
    },
  },
  plugins: [],
});

export type Auth = typeof auth;
