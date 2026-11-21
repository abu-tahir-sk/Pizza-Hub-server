import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import * as userService from "../services/user.service.js";
import { sendSuccess } from "../utils/api-response.js";
import type { UpdateProfileInput } from "../validators/user.validator.js";

export async function getMe(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await userService.getMyProfile(req.user!._id));
}

export async function updateMe(req: AuthedRequest, res: Response): Promise<void> {
  const profile = await userService.updateMyProfile(
    req.user!._id,
    req.user!.role,
    req.body as UpdateProfileInput
  );
  sendSuccess(res, profile, { message: "Profile updated successfully" });
}

export async function becomeVendor(req: AuthedRequest, res: Response): Promise<void> {
  const businessName = (req.body?.businessName as string) || "";
  const profile = await userService.becomeVendor(req.user!._id, businessName);
  sendSuccess(res, profile, { message: "Congratulations! You are now a registered vendor." });
}
