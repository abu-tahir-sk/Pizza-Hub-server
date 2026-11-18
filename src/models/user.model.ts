import mongoose, { Schema, model, Types } from "mongoose";

/**
 * Lightweight view over the Better Auth `user` collection.
 * Better Auth owns authentication fields; this model exposes the
 * business fields (role, block status, subscription) for queries
 * and keeps `strict: false` so Better Auth fields are never stripped.
 */
const userSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    image: { type: String, default: null },
    role: { type: String, enum: ["vendor", "customer", "admin"], default: "customer" },
    isBlocked: { type: Boolean, default: false },
    businessName: { type: String, default: null },
    subscriptionPlan: { type: String, enum: ["free", "premium"], default: "free" },
    subscriptionExpiresAt: { type: Date, default: null },
  },
  { collection: "user", strict: false, timestamps: true }
);

export interface UserDoc extends mongoose.Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  image?: string | null;
  role: "vendor" | "customer" | "admin";
  isBlocked: boolean;
  businessName?: string | null;
  subscriptionPlan: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const User = model<UserDoc>("User", userSchema);
