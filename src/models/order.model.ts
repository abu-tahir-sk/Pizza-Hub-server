import mongoose, { Schema, model, Types } from "mongoose";

export const ORDER_STATUSES = ["pending", "accepted", "rejected", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const orderSchema = new Schema(
  {
    itemId: { type: Types.ObjectId, ref: "menuItem", required: true, index: true },
    vendorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
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

export interface OrderDoc extends mongoose.Document {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId: Types.ObjectId;
  deliveryDate: Date;
  deliveryAddress: string;
  message: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const Order = model<OrderDoc>("order", orderSchema);
