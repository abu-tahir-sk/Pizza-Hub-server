/**
 * Admin seed script — the ONLY way an admin account is created.
 * Admin accounts can never be registered through public signup.
 *
 * Usage:  npm run seed:admin
 * Reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env
 */
import "dotenv/config";
import mongoose from "mongoose";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { connectDB } from "../src/lib/db.js";

async function seedAdmin() {
  await connectDB();
  const db = mongoose.connection.db!;

  const existing = await db.collection("user").findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    await db.collection("user").updateOne(
      { _id: existing._id },
      { $set: { role: "admin", isBlocked: false } }
    );
    console.log(`✅ Admin already exists — role ensured: ${env.ADMIN_EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const userId = randomBytes(16).toString("hex");

  await db.collection("user").insertOne({
    _id: userId,
    id: userId,
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL.toLowerCase(),
    emailVerified: true,
    image: null,
    role: "admin",
    isBlocked: false,
    businessName: null,
    subscriptionPlan: "free",
    subscriptionExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection("account").insertOne({
    _id: randomBytes(16).toString("hex"),
    id: randomBytes(16).toString("hex"),
    userId,
    accountId: env.ADMIN_EMAIL.toLowerCase(),
    providerId: "credential",
    password: passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`✅ Admin created: ${env.ADMIN_EMAIL}`);
  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
