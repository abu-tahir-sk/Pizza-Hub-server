/**
 * Admin seed script — the ONLY way an admin account is created.
 * Admin accounts can never be registered through public signup.
 *
 * Usage:  npm run seed:admin
 * Reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env
 *
 * Notes on the Better Auth MongoDB layout (verified against better-auth 1.7):
 *   user._id                      → ObjectId
 *   account.userId                → ObjectId (same value as user._id)
 *   account.accountId             → HEX STRING of user._id
 *   account.providerId            → "credential"
 *
 * Credential sign-in looks the account up with
 * `account.providerId === "credential" && account.accountId === user.id`,
 * so accountId MUST be the hex string of the user's ObjectId — not the email.
 * The script is idempotent and repairs an existing admin document, which
 * makes re-running it safe after an older seed wrote the wrong accountId.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { hashPassword } from "better-auth/crypto";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { connectDB } from "../lib/db.js";

const ADMIN_EMAIL = env.ADMIN_EMAIL.toLowerCase();

async function seedAdmin() {
  await connectDB();
  const db = mongoose.connection.db!;
  const now = new Date();
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const existing = await db.collection("user").findOne({ email: ADMIN_EMAIL });
  const userId = existing?._id instanceof ObjectId ? existing._id : new ObjectId();

  if (existing) {
    await db.collection("user").updateOne(
      { _id: userId },
      {
        $set: {
          name: env.ADMIN_NAME,
          role: "admin",
          isBlocked: false,
          emailVerified: true,
          updatedAt: now,
        },
      }
    );
  } else {
    await db.collection("user").insertOne({
      _id: userId,
      name: env.ADMIN_NAME,
      email: ADMIN_EMAIL,
      emailVerified: true,
      image: null,
      role: "admin",
      isBlocked: false,
      businessName: null,
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // One credential account per user, keyed by userId + providerId.
  await db.collection("account").updateOne(
    { userId, providerId: "credential" },
    {
      $set: {
        accountId: userId.toHexString(),
        password: passwordHash,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        providerId: "credential",
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // Remove any legacy credential row for this user that still uses another key
  // (e.g. accountId = email from an older seed), so sign-in cannot pick the
  // wrong document.
  await db.collection("account").deleteMany({
    userId,
    providerId: "credential",
    accountId: { $ne: userId.toHexString() },
  });

  console.log(
    existing
      ? `Admin repaired: ${ADMIN_EMAIL} (role=admin, password reset)`
      : `Admin created: ${ADMIN_EMAIL}`
  );
  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
