import { Router } from "express";
import { z } from "zod";
import { User } from "../models/user.model.js";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { HttpError } from "../middlewares/error.middleware.js";

export const userRouter = Router();

/**
 * PATCH /api/users/me — profile update.
 * Security: role, subscriptionPlan, subscriptionExpiresAt and isBlocked
 * are stripped server-side — a user can never elevate themselves here.
 */
userRouter.patch("/me", verifyJWT, async (req: AuthedRequest, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(2).max(60),
        image: z.string().url().nullable().optional(),
        businessName: z.string().trim().max(100).optional(),
      })
      .parse(req.body);

    const user = await User.findById(req.user!._id);
    if (!user) throw new HttpError(404, "User not found");

    user.name = body.name;
    if (body.image !== undefined) user.image = body.image;
    // Only vendors may edit businessName; never role or subscription
    if (req.user!.role === "vendor" && body.businessName !== undefined) {
      user.businessName = body.businessName;
    }
    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        businessName: user.businessName,
        subscriptionPlan: user.subscriptionPlan,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/users/me — current user profile (all roles) */
userRouter.get("/me", verifyJWT, async (req: AuthedRequest, res, next) => {
  try {
    const user = await User.findById(req.user!._id).select(
      "-passwordHash -__v"
    );
    if (!user) throw new HttpError(404, "User not found");
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
