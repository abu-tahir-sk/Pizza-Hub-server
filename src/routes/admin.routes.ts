import { Router } from "express";
import { z } from "zod";
import { User } from "../models/user.model.js";
import { MenuItem, MENU_CATEGORIES } from "../models/menuItem.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Order } from "../models/order.model.js";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { HttpError } from "../middlewares/error.middleware.js";

export const adminRouter = Router();

adminRouter.use(verifyJWT, requireRole("admin"));

/* ─────────────────────────── USERS ─────────────────────────── */

/** GET /api/admin/users?search=&role=&page=&limit= */
adminRouter.get("/users", async (req, res, next) => {
  try {
    const { search, role } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }
    if (role && ["vendor", "customer", "admin"].includes(role)) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({ success: true, data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/users/:id — user details */
adminRouter.get("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, "User not found");
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/users/:id/block-status — block / unblock */
adminRouter.patch("/users/:id/block-status", async (req, res, next) => {
  try {
    const { isBlocked } = z.object({ isBlocked: z.boolean() }).parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.role === "admin") throw new HttpError(403, "Admin accounts cannot be blocked");

    user.isBlocked = isBlocked;
    await user.save();
    res.json({ success: true, message: `User ${isBlocked ? "blocked" : "unblocked"}`, data: user });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────── MENU MODERATION ─────────────────────── */

/** GET /api/admin/menu-items?search=&status=&category= */
adminRouter.get("/menu-items", async (req, res, next) => {
  try {
    const { search, status, category } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const filter: Record<string, unknown> = {};
    if (status && ["pending", "approved", "rejected", "inactive"].includes(status)) filter.status = status;
    if (category && (MENU_CATEGORIES as readonly string[]).includes(category)) filter.category = category;
    if (search) filter.itemName = { $regex: search.trim(), $options: "i" };

    const [items, total] = await Promise.all([
      MenuItem.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("vendorId", "name businessName email"),
      MenuItem.countDocuments(filter),
    ]);

    res.json({ success: true, data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/menu-items/:id/status — approve / reject / deactivate */
adminRouter.patch("/menu-items/:id/status", async (req, res, next) => {
  try {
    const { status, rejectionReason } = z
      .object({
        status: z.enum(["approved", "rejected", "inactive"]),
        rejectionReason: z.string().trim().max(300).optional(),
      })
      .parse(req.body);

    const item = await MenuItem.findById(req.params.id);
    if (!item) throw new HttpError(404, "Menu item not found");

    item.status = status;
    item.rejectionReason = status === "rejected" ? rejectionReason ?? "Rejected by admin" : null;
    await item.save();
    res.json({ success: true, message: `Item status updated to ${status}`, data: item });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/admin/menu-items/:id — delete an inappropriate item */
adminRouter.delete("/menu-items/:id", async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) throw new HttpError(404, "Menu item not found");
    await Order.updateMany({ itemId: item._id, status: "pending" }, { status: "cancelled" });
    res.json({ success: true, message: "Menu item deleted" });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────── TRANSACTIONS ─────────────────────────── */

/**
 * GET /api/admin/transactions — read-only list. Admins can monitor
 * payments but there is deliberately NO endpoint to edit a
 * transaction (e.g. marking failed as paid).
 */
adminRouter.get("/transactions", async (req, res, next) => {
  try {
    const { status } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const filter: Record<string, unknown> = {};
    if (status && ["pending", "paid", "failed", "expired"].includes(status)) filter.status = status;

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

    res.json({
      success: true,
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalRevenue: revenueAgg[0]?.totalRevenue ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────── OVERVIEW ─────────────────────────── */

/** GET /api/admin/overview — dashboard statistics */
adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const [totalUsers, vendors, customers, totalMenuItems, pendingMenuItems, txAgg] = await Promise.all([
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

    res.json({
      success: true,
      data: {
        totalUsers,
        vendors,
        customers,
        totalMenuItems,
        pendingMenuItems,
        totalTransactions: txAgg[0]?.count ?? 0,
        totalRevenue: txAgg[0]?.total ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
