import { User } from "../models/user.model.js";
import { HttpError } from "../middlewares/error.middleware.js";
import type { UpdateProfileInput } from "../validators/user.validator.js";

/** Never return password hashes or internal auth fields to the client. */
const PUBLIC_PROFILE_FIELDS = "name email image role businessName subscriptionPlan subscriptionExpiresAt isBlocked createdAt";

export async function getMyProfile(userId: string) {
  const user = await User.findById(userId).select(PUBLIC_PROFILE_FIELDS);
  if (!user) throw new HttpError(404, "User not found");
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
