import type { Request } from "express";
import mongoose from "mongoose";
import { auth } from "../lib/auth.js";
import { signJwt } from "../lib/jwt.js";
import { User } from "../models/user.model.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { env } from "../config/env.js";

export interface SessionExchangeResult {
  token: string;
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
    role: "vendor" | "customer" | "admin";
    isBlocked: boolean;
    businessName?: string | null;
    subscriptionPlan: "free" | "premium";
  };
}

/**
 * Validates a Better Auth session cookie or explicit session token and mints
 * the short-lived JWT used by the Express business APIs.
 * Supports cross-domain fallback when third-party cookies are blocked by browser.
 */
export async function exchangeSessionForJwt(
  headers: Request["headers"],
  rawSessionToken?: string
): Promise<SessionExchangeResult> {
  let userId: string | null = null;

  // 1. Try explicit session token if supplied (e.g. from cross-domain OAuth redirect)
  if (rawSessionToken && typeof rawSessionToken === "string") {
    try {
      const db = mongoose.connection.useDb(env.MONGODB_DB_NAME);
      const sessionDoc = await db.collection("session").findOne({
        token: rawSessionToken.trim(),
        expiresAt: { $gt: new Date() },
      });
      if (sessionDoc?.userId) {
        userId = sessionDoc.userId.toString();
      }
    } catch {
      // Fall through to cookie-based check
    }
  }

  // 2. Cookie-based Better Auth session check
  if (!userId) {
    const session = await auth.api.getSession({ headers });
    if (session?.user?.id) {
      userId = session.user.id;
    }
  }

  if (!userId) throw new HttpError(401, "Unauthorized — no active session");

  const dbUser = await User.findById(userId);
  if (!dbUser) throw new HttpError(401, "Unauthorized — user no longer exists");
  if (dbUser.isBlocked) throw new HttpError(403, "Your account has been blocked");

  const token = signJwt({
    sub: dbUser._id.toString(),
    email: dbUser.email,
    role: dbUser.role,
  });

  return {
    token,
    user: {
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
      role: dbUser.role,
      isBlocked: dbUser.isBlocked,
      businessName: dbUser.businessName,
      subscriptionPlan: dbUser.subscriptionPlan,
    },
  };
}
