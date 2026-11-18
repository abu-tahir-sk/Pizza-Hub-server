import { Router } from "express";
import type { Request } from "express";
import { auth } from "../lib/auth.js";
import { signJwt } from "../lib/jwt.js";
import { User } from "../models/user.model.js";
import { HttpError } from "../middlewares/error.middleware.js";

export const authRouter = Router();

/**
 * POST /api/auth-extra/token
 * Session→JWT bridge: verifies the Better Auth session cookie server-side
 * and mints a short-lived PizzaHub JWT (HS256). The client sends this token
 * as `Authorization: Bearer <token>` on protected API calls.
 */
authRouter.post("/token", async (req: Request, res, next) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) throw new HttpError(401, "Unauthorized — no active session");

    const dbUser = await User.findById(session.user.id);
    if (!dbUser) throw new HttpError(401, "Unauthorized — user no longer exists");
    if (dbUser.isBlocked) throw new HttpError(403, "Your account has been blocked");

    const token = signJwt({
      sub: dbUser._id.toString(),
      email: dbUser.email,
      role: dbUser.role,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: dbUser._id,
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.image,
          role: dbUser.role,
          isBlocked: dbUser.isBlocked,
          businessName: dbUser.businessName,
          subscriptionPlan: dbUser.subscriptionPlan,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
