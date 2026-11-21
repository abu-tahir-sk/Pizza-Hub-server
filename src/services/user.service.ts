import { User } from "../models/user.model.js";
import { HttpError } from "../middlewares/error.middleware.js";
import type { UpdateProfileInput } from "../validators/user.validator.js";

/** Never return password hashes or internal auth fields to the client. */
const PUBLIC_PROFILE_FIELDS = "name email image role businessName subscriptionPlan subscriptionExpiresAt isBlocked createdAt";

export async function getMyProfile(userId: string) {
  const user = await User.findById(userId).select(PUBLIC_PROFILE_FIELDS);
  if (!user) throw new HttpError(404, "User not found");

  // Keep the displayed plan honest once a Premium period has elapsed.
  if (
    user.subscriptionPlan === "premium" &&
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt.getTime() <= Date.now()
  ) {
    user.subscriptionPlan = "free";
    user.subscriptionExpiresAt = null;
    await user.save();
  }

  return user;
}

/**
 * Only non-privileged profile fields are accepted. The zod schema strips
 * role, block state and subscription fields, so privilege escalation through
 * this endpoint is impossible.
 */
export async function updateMyProfile(
  userId: string,
  role: "vendor" | "customer" | "admin",
  body: UpdateProfileInput
) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "User not found");

  user.name = body.name;
  if (body.image !== undefined) user.image = body.image;
  if (role === "vendor" && body.businessName !== undefined) {
    user.businessName = body.businessName;
  }
  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    businessName: user.businessName,
    subscriptionPlan: user.subscriptionPlan,
  };
}

export async function becomeVendor(userId: string, businessName: string) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "User not found");
  if (user.role === "admin") throw new HttpError(403, "Admin cannot switch to vendor");
  if (user.role === "vendor") throw new HttpError(400, "You are already a registered vendor");

  if (!businessName || businessName.trim().length < 2) {
    throw new HttpError(400, "Please enter a valid restaurant or business name (at least 2 characters)");
  }

  user.role = "vendor";
  user.businessName = businessName.trim();
  user.subscriptionPlan = user.subscriptionPlan || "free";
  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    businessName: user.businessName,
    subscriptionPlan: user.subscriptionPlan,
  };
}
