import { User } from "../models/user.model.js";
import { MenuItem, MENU_CATEGORIES } from "../models/menuItem.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Order } from "../models/order.model.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { paginatedMeta } from "../utils/api-response.js";
import type { BlockStatusInput, MenuStatusInput } from "../validators/admin.validator.js";

function rawQuery(query: unknown): Record<string, unknown> {
  return (query ?? {}) as Record<string, unknown>;
}
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function paging(query: Record<string, unknown>, fallback = 10) {
  return {
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(50, Math.max(1, Number(query.limit) || fallback)),
  };
}

export async function listUsers(query: unknown) {
  const q = rawQuery(query);
  const { page, limit } = paging(q);
  const search = str(q.search);
  const role = str(q.role);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { email: { $regex: search.trim(), $options: "i" } },
    ];
  }
  if (role && ["vendor", "customer", "admin"].includes(role)) filter.role = role;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { users, meta: paginatedMeta(total, page, limit) };
}

export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function setUserBlockStatus(id: string, body: BlockStatusInput) {
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "User not found");
  if (user.role === "admin") throw new HttpError(403, "Admin accounts cannot be blocked");

  user.isBlocked = body.isBlocked;
  await user.save();
  return user;
}

export async function listMenuItems(query: unknown) {
  const q = rawQuery(query);
  const { page, limit } = paging(q);
  const search = str(q.search);
  const status = str(q.status);
  const category = str(q.category);

  const filter: Record<string, unknown> = {};
  if (status && ["pending", "approved", "rejected", "inactive"].includes(status)) {
    filter.status = status;
  }
  if (category && (MENU_CATEGORIES as readonly string[]).includes(category)) {
    filter.category = category;
  }
  if (search) filter.itemName = { $regex: search.trim(), $options: "i" };

  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("vendorId", "name businessName email"),
    MenuItem.countDocuments(filter),
  ]);
  return { items, meta: paginatedMeta(total, page, limit) };
}

export async function setMenuItemStatus(id: string, body: MenuStatusInput) {
  const item = await MenuItem.findById(id);
  if (!item) throw new HttpError(404, "Menu item not found");

  item.status = body.status;
  item.rejectionReason = body.status === "rejected" ? body.rejectionReason ?? "Rejected by admin" : null;
  await item.save();
  return item;
}

export async function deleteMenuItem(id: string) {
  const item = await MenuItem.findByIdAndDelete(id);
  if (!item) throw new HttpError(404, "Menu item not found");
  await Order.updateMany({ itemId: item._id, status: "pending" }, { status: "cancelled" });
}

export async function listTransactions(query: unknown) {
  const q = rawQuery(query);
  const { page, limit } = paging(q);
  const status = str(q.status);

  const filter: Record<string, unknown> = {};
  if (status && ["pending", "paid", "failed", "expired"].includes(status)) {
    filter.status = status;
  }

  const [transactions, total, revenueAgg] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("vendorId", "name businessName email"),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    transactions,
    meta: {
      ...paginatedMeta(total, page, limit),
      totalRevenue: revenueAgg[0]?.totalRevenue ?? 0,
    },
  };
}

export async function getOverview() {
  const [totalUsers, vendors, customers, totalMenuItems, pendingMenuItems, txAgg] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "vendor" }),
      User.countDocuments({ role: "customer" }),
      MenuItem.countDocuments({}),
      MenuItem.countDocuments({ status: "pending" }),
      Transaction.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

  return {
    totalUsers,
    vendors,
    customers,
    totalMenuItems,
    pendingMenuItems,
    totalTransactions: txAgg[0]?.count ?? 0,
    totalRevenue: txAgg[0]?.total ?? 0,
  };
}
