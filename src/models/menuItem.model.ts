import mongoose, { Schema, model, Types } from "mongoose";

export const MENU_CATEGORIES = [
  "Classic Pizzas",
  "Vegetarian Pizzas",
  "Meat Lovers",
  "Specialty / Gourmet Pizzas",
  "Sides & Appetizers",
  "Beverages & Desserts",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];
export type MenuItemStatus = "pending" | "approved" | "rejected" | "inactive";

const menuItemSchema = new Schema(
  {
    vendorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    itemName: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, enum: MENU_CATEGORIES, required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    price: { type: Number, required: true, min: 0, max: 100000 },
    location: { type: String, required: true, trim: true, maxlength: 120, index: true },
    images: {
      type: [String],
      required: true,
      validate: [(v: string[]) => v.length > 0, "At least one image is required"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "inactive"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

menuItemSchema.index({ itemName: "text", description: "text" });

export interface MenuItemDoc extends mongoose.Document {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  itemName: string;
  category: MenuCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: MenuItemStatus;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MenuItem = model<MenuItemDoc>("menuItem", menuItemSchema);
