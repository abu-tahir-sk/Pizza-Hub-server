import { Router } from "express";
import { z } from "zod";
import { Order, ORDER_STATUSES } from "../models/order.model.js";
import { MenuItem } from "../models/menuItem.model.js";
import { User } from "../models/user.model.js";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { HttpError } from "../middlewares/error.middleware.js";

export const orderRouter = Router();

const createOrderSchema = z.object({
  itemId: z.string().min(1),
  deliveryDate: z.coerce.date(),
  deliveryAddress: z.string().trim().min(5).max(300),
  message: z.string().trim().max(500).optional().default(""),
});

const ACTIVE_STATUSES = ["pending", "accepted"];

/* ─────────────────────────── CUSTOMER ─────────────────────────── */

/** GET /api/orders/my — customer's own orders */
orderRouter.get("/my", verifyJWT, requireRole("customer"), async (req: AuthedRequest, res, next) => {
  try {
    const orders = await Order.find({ customerId: req.user!._id })
      .sort({ createdAt: -1 })
      .populate("itemId", "itemName images price category")
      .populate("vendorId", "name businessName image");
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

/** POST /api/orders — place an order (customer only) */
orderRouter.post("/", verifyJWT, requireRole("customer"), async (req: AuthedRequest, res, next) => {
  try {
    const body = createOrderSchema.parse(req.body);

    const item = await MenuItem.findById(body.itemId).populate("vendorId");
    if (!item) throw new HttpError(404, "Menu item not found");
    if (item.status !== "approved") {
      throw new HttpError(400, "This item is not available for ordering");
    }

    const vendor = item.vendorId as unknown as { _id: unknown };
    const vendorId = item.vendorId;

    // A vendor account can never order (they're not "customer" role anyway,
    // but the check also guards a user holding both roles).
    if (String(vendorId) === String(req.user!._id)) {
      throw new HttpError(403, "You cannot order your own item");
    }

    // No duplicate active order for the same item + delivery date
    const duplicate = await Order.findOne({
      customerId: req.user!._id,
      itemId: body.itemId,
      deliveryDate: body.deliveryDate,
      status: { $in: ACTIVE_STATUSES },
    });
    if (duplicate) {
      throw new HttpError(409, "You already have an active order for this item on this delivery date");
    }

    if (body.deliveryDate.getTime() < Date.now() - 60_000) {
      throw new HttpError(400, "Delivery date must be in the future");
    }

    const order = await Order.create({
      itemId: item._id,
      vendorId,
      customerId: req.user!._id,
      deliveryDate: body.deliveryDate,
      deliveryAddress: body.deliveryAddress,
      message: body.message,
      status: "pending",
    });

    res.status(201).json({ success: true, message: "Order placed successfully", data: order });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/orders/:id/cancel — customer cancels own pending order (once) */
orderRouter.patch("/:id/cancel", verifyJWT, requireRole("customer"), async (req: AuthedRequest, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customerId: req.user!._id });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "pending") {
      throw new HttpError(409, `Only pending orders can be cancelled (current status: ${order.status})`);
    }
    order.status = "cancelled";
    await order.save();
    res.json({ success: true, message: "Order cancelled", data: order });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────── VENDOR ─────────────────────────── */

/** GET /api/orders/vendor — orders for this vendor's items */
orderRouter.get("/vendor", verifyJWT, requireRole("vendor"), async (req: AuthedRequest, res, next) => {
  try {
    const orders = await Order.find({ vendorId: req.user!._id })
      .sort({ createdAt: -1 })
      .populate("itemId", "itemName images price")
      .populate("customerId", "name email image");
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/orders/:id/decision — vendor accepts/rejects own pending order (once) */
orderRouter.patch(
  "/:id/decision",
  verifyJWT,
  requireRole("vendor"),
  async (req: AuthedRequest, res, next) => {
    try {
      const decision = z
        .object({ status: z.enum(["accepted", "rejected"]) })
        .parse(req.body);

      const order = await Order.findOne({ _id: req.params.id, vendorId: req.user!._id });
      if (!order) throw new HttpError(404, "Order not found");
      if (order.status !== "pending") {
        throw new HttpError(409, `This order has already been ${order.status} — it can only be decided once`);
      }

      order.status = decision.status;
      await order.save();
      res.json({ success: true, message: `Order ${decision.status}`, data: order });
    } catch (err) {
      next(err);
    }
  }
);

/* ─────────────────────────── SHARED ─────────────────────────── */

/** GET /api/orders/stats — role-aware overview stats */
orderRouter.get("/stats", verifyJWT, async (req: AuthedRequest, res, next) => {
  try {
    const role = req.user!.role;
    if (role === "customer") {
      const all = await Order.countDocuments({ customerId: req.user!._id });
      const [pending, accepted, rejected, cancelled] = await Promise.all(
        ["pending", "accepted", "rejected", "cancelled"].map((s) =>
          Order.countDocuments({ customerId: req.user!._id, status: s })
        )
      );
      return res.json({ success: true, data: { total: all, pending, accepted, rejected, cancelled } });
    }
    if (role === "vendor") {
      const all = await Order.countDocuments({ vendorId: req.user!._id });
      const [pending, accepted, rejected] = await Promise.all(
        ["pending", "accepted", "rejected"].map((s) =>
          Order.countDocuments({ vendorId: req.user!._id, status: s })
        )
      );
      return res.json({ success: true, data: { total: all, pending, accepted, rejected } });
    }
    if (role === "admin") {
      const all = await Order.countDocuments({});
      const pending = await Order.countDocuments({ status: "pending" });
      return res.json({ success: true, data: { total: all, pending } });
    }
    throw new HttpError(403, "Forbidden");
  } catch (err) {
    next(err);
  }
});

/** GET /api/orders/:id — details (owner, vendor of the item, or admin) */
orderRouter.get("/:id", verifyJWT, async (req: AuthedRequest, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("itemId", "itemName images price category")
      .populate("vendorId", "name businessName image")
      .populate("customerId", "name email image");
    if (!order) throw new HttpError(404, "Order not found");

    const uid = req.user!._id;
    if (req.user!.role !== "admin" && String(order.customerId._id) !== uid && String(order.vendorId._id) !== uid) {
      throw new HttpError(403, "You do not have access to this order");
    }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});
