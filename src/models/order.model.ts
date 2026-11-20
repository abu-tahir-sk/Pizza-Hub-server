import mongoose, { Schema, model, Types } from "mongoose";

export const ORDER_STATUSES = ["pending", "accepted", "rejected", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const orderSchema = new Schema(
  {
    itemId: { type: Types.ObjectId, ref: "menuItem", required: true, index: true },
    vendorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    quantity: { type: Number, default: 1, min: 1, max: 20 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cod", index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid", index: true },
    stripeSessionId: { type: String, default: null },
    deliveryDate: { type: Date, required: true },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 300 },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
  },
  { timestamps: true }
);

// One active order per (customer, item, delivery date)
orderSchema.index(
  { customerId: 1, itemId: 1, deliveryDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

export interface OrderDoc {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId: Types.ObjectId;
  quantity: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  stripeSessionId?: string | null;
  deliveryDate: Date;
  deliveryAddress: string;
  message: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const Order = model<OrderDoc>("order", orderSchema);
