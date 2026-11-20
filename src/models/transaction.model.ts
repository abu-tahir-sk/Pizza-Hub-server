import mongoose, { Schema, model, Types } from "mongoose";

const transactionSchema = new Schema(
  {
    vendorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Types.ObjectId, ref: "User", default: null, index: true },
    orderId: { type: Types.ObjectId, ref: "order", default: null, index: true },
    plan: { type: String, enum: ["premium", "pizza_order", "customer_order"], default: "premium" },
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

export interface TransactionDoc {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  orderId?: Types.ObjectId | null;
  plan: "premium" | "pizza_order" | "customer_order";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string | null;
  status: "pending" | "paid" | "failed" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

export const Transaction = model<TransactionDoc>("transaction", transactionSchema);
