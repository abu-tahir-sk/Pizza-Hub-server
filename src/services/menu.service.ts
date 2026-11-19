import { MenuItem, MENU_CATEGORIES } from "../models/menuItem.model.js";
import { Order } from "../models/order.model.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { paginatedMeta } from "../utils/api-response.js";
import type {
  CreateItemInput,
  ListMenuQuery,
  UpdateItemInput,
} from "../validators/menu.validator.js";

const MAX_FREE_ACTIVE_ITEMS = 3;

export interface MenuActor {
  _id: string;
  subscriptionPlan: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function rawQuery(query: unknown): Record<string, unknown> {
  return (query ?? {}) as Record<string, unknown>;
}

/** Public catalog: approved items only, with optional filters and paging. */
export async function listMenuItems(query: unknown) {
  const q = rawQuery(query);
  const search = asString(q.search);
  const category = asString(q.category);
  const location = asString(q.location);
  const vendorId = asString(q.vendorId);
  const minPrice = q.minPrice === undefined ? undefined : Number(q.minPrice);
  const maxPrice = q.maxPrice === undefined ? undefined : Number(q.maxPrice);

  const sortBy = q.sortBy === "price" ? "price" : null;
  const sortDir = q.sortDir === "desc" ? -1 : 1;
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(q.limit) || 9));

  const filter: Record<string, unknown> = { status: "approved" };
  if (vendorId) filter.vendorId = vendorId;
  if (category && (MENU_CATEGORIES as readonly string[]).includes(category)) {
    filter.category = category;
  }
  if (location) filter.location = { $regex: location.trim(), $options: "i" };
  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" };
    filter.$or = [
      { itemName: regex },
      { description: regex },
      { category: regex },
      { location: regex },
    ];
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined && !Number.isNaN(minPrice) ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined && !Number.isNaN(maxPrice) ? { $lte: maxPrice } : {}),
    };
  }

  const sort: Record<string, 1 | -1> = sortBy ? { price: sortDir } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("vendorId", "name businessName image subscriptionPlan"),
    MenuItem.countDocuments(filter),
  ]);

  return { items, meta: paginatedMeta(total, page, limit) };
}

export async function getFeaturedMenu() {
  return MenuItem.find({ status: "approved" })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("vendorId", "name businessName image subscriptionPlan");
}

export async function getMenuItemById(id: string) {
  const item = await MenuItem.findById(id).populate(
    "vendorId",
    "name businessName image subscriptionPlan"
  );
  if (!item || (item.status !== "approved" && item.status !== "inactive")) {
    throw new HttpError(404, "Menu item not found");
  }
  return item;
}

export async function getVendorMenuItems(vendorId: string) {
  return MenuItem.find({ vendorId }).sort({ createdAt: -1 });
}

export async function createMenuItem(actor: MenuActor, body: CreateItemInput) {
  const activeCount = await MenuItem.countDocuments({
    vendorId: actor._id,
    status: { $in: ["approved", "pending", "inactive"] },
  });

  const isPremium =
    actor.subscriptionPlan === "premium" &&
    (!actor.subscriptionExpiresAt || actor.subscriptionExpiresAt > new Date());

  if (!isPremium && activeCount >= MAX_FREE_ACTIVE_ITEMS) {
    throw new HttpError(
      403,
      `Free plan allows a maximum of ${MAX_FREE_ACTIVE_ITEMS} menu items. Upgrade to Premium for unlimited items.`
    );
  }

  return MenuItem.create({ ...body, vendorId: actor._id, status: "pending" });
}

export async function updateMenuItem(
  id: string,
  vendorId: string,
  body: UpdateItemInput
) {
  const item = await MenuItem.findOne({ _id: id, vendorId });
  if (!item) throw new HttpError(404, "Menu item not found");

  // Approval status is admin-only. Vendors can only toggle availability.
  if (body.status !== undefined) {
    if (item.status === "rejected") {
      throw new HttpError(403, "A rejected item cannot be re-activated. Contact the admin.");
    }
    if (item.status === "pending") {
      throw new HttpError(403, "This item is awaiting admin approval.");
    }
  }

  const editableKeys = [
    "itemName",
    "category",
    "description",
    "price",
    "location",
    "images",
  ] as const;
  for (const key of editableKeys) {
    if (body[key] !== undefined) {
      // Assignment is intentionally narrow: only validated, whitelisted fields.
      (item as unknown as Record<string, unknown>)[key] = body[key];
    }
  }

  if (body.status !== undefined) {
    item.status = body.status === "active" ? "approved" : "inactive";
  }

  await item.save();
  return item;
}

export async function deleteMenuItem(id: string, vendorId: string) {
  const item = await MenuItem.findOneAndDelete({ _id: id, vendorId });
  if (!item) throw new HttpError(404, "Menu item not found");

  // Keep referential sanity: pending orders referencing this item are cancelled.
  await Order.updateMany({ itemId: item._id, status: "pending" }, { status: "cancelled" });
}
