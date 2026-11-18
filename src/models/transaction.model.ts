import mongoose, { Schema, model, Types } from "mongoose";

const transactionSchema = new Schema(
  {
    vendorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: String, enum: ["premium"], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "usd" },
    stripeSessionId: { type: String, required: true, index: true },
    stripeSubscriptionId: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

export interface TransactionDoc extends mongoose.Document {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  plan: "premium";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string | null;
  status: "pending" | "paid" | "failed" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

export const Transaction = model<TransactionDoc>("transaction", transactionSchema);
