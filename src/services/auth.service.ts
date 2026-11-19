import type { Request } from "express";
import { auth } from "../lib/auth.js";
import { signJwt } from "../lib/jwt.js";
import { User } from "../models/user.model.js";
import { HttpError } from "../middlewares/error.middleware.js";

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
 * Validates a Better Auth session cookie and mints the short-lived JWT used
 * by the Express business APIs. Role and block state are read from MongoDB,
 * never from the token or the client.
 */
export async function exchangeSessionForJwt(
  headers: Request["headers"]
): Promise<SessionExchangeResult> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new HttpError(401, "Unauthorized — no active session");

  const dbUser = await User.findById(session.user.id);
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
