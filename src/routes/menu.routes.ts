import { Router } from "express";
import { z } from "zod";
import { MenuItem, MENU_CATEGORIES } from "../models/menuItem.model.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { env } from "../config/env.js";

export const menuRouter = Router();

const MAX_FREE_ACTIVE_ITEMS = 3;

const createItemSchema = z.object({
  itemName: z.string().trim().min(2).max(100),
  category: z.enum(MENU_CATEGORIES),
  description: z.string().trim().min(10).max(1000),
  price: z.coerce.number().min(0).max(100000),
  location: z.string().trim().min(2).max(120),
  images: z.array(z.string().url()).min(1).max(5),
});

const updateItemSchema = createItemSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(), // vendors can only toggle availability
});

/* ─────────────────────────── PUBLIC ─────────────────────────── */

/**
 * GET /api/menu — public browse endpoint (approved + active items only).
 * Query params:
 *  search        — name/description text search
 *  category      — one of MENU_CATEGORIES
 *  location      — partial match on location
 *  minPrice/maxPrice — price range
 *  sortBy=price&sortDir=asc|desc — price sorting
 *  vendorId      — items of a single vendor
 *  page / limit  — pagination (default limit 9, max 50)
 */
menuRouter.get("/", async (req, res, next) => {
  try {
    const { search, category, location, minPrice, maxPrice, vendorId } = req.query as Record<string, string>;
    const sortBy = req.query.sortBy === "price" ? "price" : null;
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 9));

    const filter: Record<string, unknown> = { status: "approved" };
    if (vendorId) filter.vendorId = vendorId;
    if (category && (MENU_CATEGORIES as readonly string[]).includes(category)) filter.category = category;
    if (location) filter.location = { $regex: location.trim(), $options: "i" };
    if (search) filter.$text = { $search: search.trim() };
    if (minPrice || maxPrice) {
      filter.price = {
        ...(minPrice ? { $gte: Number(minPrice) } : {}),
        ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
      };
    }

    const sort = sortBy ? { price: sortDir as 1 | -1 } : { createdAt: -1 as const };

    const [items, total] = await Promise.all([
      MenuItem.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate("vendorId", "name businessName image"),
      MenuItem.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/menu/featured — homepage featured items (latest approved & active) */
menuRouter.get("/featured", async (_req, res, next) => {
  try {
    const items = await MenuItem.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("vendorId", "name businessName image subscriptionPlan");
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

/** GET /api/menu/:id — public item details */
menuRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate(
      "vendorId",
      "name businessName image subscriptionPlan"
    );
    if (!item || (item.status !== "approved" && item.status !== "inactive")) {
      throw new HttpError(404, "Menu item not found");
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────── VENDOR ─────────────────────────── */

/** GET /api/menu/vendor/my-items — vendor's own items (any status) */
menuRouter.get("/vendor/my-items", verifyJWT, requireRole("vendor"), async (req: AuthedRequest, res, next) => {
  try {
    const items = await MenuItem.find({ vendorId: req.user!._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

/** POST /api/menu — create item (default status pending; free-plan limit enforced server-side) */
menuRouter.post("/", verifyJWT, requireRole("vendor"), async (req: AuthedRequest, res, next) => {
  try {
    const body = createItemSchema.parse(req.body);

    const activeCount = await MenuItem.countDocuments({
      vendorId: req.user!._id,
      status: { $in: ["approved", "pending", "inactive"] },
    });

    const isPremium =
      req.user!.subscriptionPlan === "premium" &&
      (!req.user!.subscriptionExpiresAt || req.user!.subscriptionExpiresAt > new Date());

    if (!isPremium && activeCount >= MAX_FREE_ACTIVE_ITEMS) {
      throw new HttpError(403, `Free plan allows a maximum of ${MAX_FREE_ACTIVE_ITEMS} menu items. Upgrade to Premium for unlimited items.`);
    }

    const item = await MenuItem.create({
      ...body,
      vendorId: req.user!._id,
      status: "pending",
    });
    res.status(201).json({ success: true, message: "Menu item created — pending admin approval", data: item });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/menu/:id — vendor updates own item */
menuRouter.patch("/:id", verifyJWT, requireRole("vendor"), async (req: AuthedRequest, res, next) => {
  try {
    const body = updateItemSchema.parse(req.body);
    const item = await MenuItem.findOne({ _id: req.params.id, vendorId: req.user!._id });
    if (!item) throw new HttpError(404, "Menu item not found");

    // Ownership verified above; vendors may toggle availability and edit content,
    // but never set approval status themselves.
    const allowed: Partial<typeof body> = {};
    if (body.itemName !== undefined) allowed.itemName = body.itemName;
    if (body.category !== undefined) allowed.category = body.category;
    if (body.description !== undefined) allowed.description = body.description;
    if (body.price !== undefined) allowed.price = body.price;
    if (body.location !== undefined) allowed.location = body.location;
    if (body.images !== undefined) allowed.images = body.images;
    if (body.status !== undefined) {
      if (item.status === "rejected") {
        throw new HttpError(403, "A rejected item cannot be re-activated. Contact the admin.");
      }
      allowed.status = body.status; // approved <-> inactive only
    }

    Object.assign(item, allowed);
    await item.save();
    res.json({ success: true, message: "Menu item updated", data: item });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/menu/:id — vendor deletes own item */
menuRouter.delete("/:id", verifyJWT, requireRole("vendor"), async (req: AuthedRequest, res, next) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, vendorId: req.user!._id });
    if (!item) throw new HttpError(404, "Menu item not found");
    // Keep referential sanity: pending orders referencing this item are cancelled
    await Order.updateMany({ itemId: item._id, status: "pending" }, { status: "cancelled" });
    res.json({ success: true, message: "Menu item deleted" });
  } catch (err) {
    next(err);
  }
});
