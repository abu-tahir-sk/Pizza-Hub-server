import type { NextFunction, Request, Response } from "express";
import { verifyJwt } from "../lib/jwt.js";
import { User } from "../models/user.model.js";

export interface AuthedRequest extends Request {
  user?: {
    _id: string;
    name?: string | null;
    email: string;
    role: "vendor" | "customer" | "admin";
    isBlocked: boolean;
    subscriptionPlan: "free" | "premium";
    subscriptionExpiresAt?: Date | null;
  };
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/**
 * JWT verification middleware — protected routes reject invalid or
 * expired tokens with 401. Role/block state is re-read from the DB so
 * a stale or forged token can never grant access.
 */
export async function verifyJWT(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized — missing token" });
    }

    let payload;
    try {
      payload = verifyJwt(token);
    } catch {
      return res.status(401).json({ success: false, message: "Unauthorized — invalid or expired token" });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized — user no longer exists" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Your account has been blocked" });
    }

    req.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Role-based middleware — e.g. requireRole("admin"), requireRole("vendor", "customer") */
export function requireRole(...roles: Array<"admin" | "vendor" | "customer">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden — insufficient permissions. You are logged in as "${req.user.role}", which cannot perform this action (requires ${roles.join(" or ")}).`,
      });
    }
    next();
  };
}
