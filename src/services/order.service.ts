import { Order, type OrderStatus } from "../models/order.model.js";
import { MenuItem } from "../models/menuItem.model.js";
import { HttpError } from "../middlewares/error.middleware.js";
import type { CreateOrderInput, DecideOrderInput } from "../validators/order.validator.js";

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "accepted"];

export async function getCustomerOrders(customerId: string) {
  return Order.find({ customerId })
    .sort({ createdAt: -1 })
    .populate("itemId", "itemName images price category")
    .populate("vendorId", "name businessName image");
}

export async function createOrder(customerId: string, body: CreateOrderInput) {
  const item = await MenuItem.findById(body.itemId).populate("vendorId");
  if (!item) throw new HttpError(404, "Menu item not found");
  if (item.status !== "approved") {
    throw new HttpError(400, "This item is not available for ordering");
  }

  const vendorId = item.vendorId;
  if (String(vendorId) === String(customerId)) {
    throw new HttpError(403, "You cannot order your own item");
  }

  const duplicate = await Order.findOne({
    customerId,
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

  return Order.create({
    itemId: item._id,
    vendorId,
    customerId,
    deliveryDate: body.deliveryDate,
    deliveryAddress: body.deliveryAddress,
    message: body.message,
    status: "pending",
  });
}

export async function cancelOrder(orderId: string, customerId: string) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "pending") {
    throw new HttpError(409, `Only pending orders can be cancelled (current status: ${order.status})`);
  }
  order.status = "cancelled";
  await order.save();
  return order;
}

export async function getVendorOrders(vendorId: string) {
  return Order.find({ vendorId })
    .sort({ createdAt: -1 })
    .populate("itemId", "itemName images price")
    .populate("customerId", "name email image");
}

export async function decideOrder(
  orderId: string,
  vendorId: string,
  decision: DecideOrderInput
) {
  const order = await Order.findOne({ _id: orderId, vendorId });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "pending") {
    throw new HttpError(409, `This order has already been ${order.status} — it can only be decided once`);
  }
  order.status = decision.status;
  await order.save();
  return order;
}

export async function getOrderStats(actor: {
  _id: string;
  role: "customer" | "vendor" | "admin";
}) {
  const { _id, role } = actor;

  if (role === "customer") {
    const all = await Order.countDocuments({ customerId: _id });
    const [pending, accepted, rejected, cancelled] = await Promise.all(
      (["pending", "accepted", "rejected", "cancelled"] as OrderStatus[]).map((s) =>
        Order.countDocuments({ customerId: _id, status: s })
      )
    );
    return { total: all, pending, accepted, rejected, cancelled };
  }

  if (role === "vendor") {
    const all = await Order.countDocuments({ vendorId: _id });
    const [pending, accepted, rejected] = await Promise.all(
      (["pending", "accepted", "rejected"] as OrderStatus[]).map((s) =>
        Order.countDocuments({ vendorId: _id, status: s })
      )
    );
    return { total: all, pending, accepted, rejected };
  }

  if (role === "admin") {
    const [total, pending] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ status: "pending" }),
    ]);
    return { total, pending };
  }

  throw new HttpError(403, "Forbidden");
}

export async function getOrderById(
  id: string,
  actor: { _id: string; role: "customer" | "vendor" | "admin" }
) {
  const order = await Order.findById(id)
    .populate("itemId", "itemName images price category")
    .populate("vendorId", "name businessName image")
    .populate("customerId", "name email image");
  if (!order) throw new HttpError(404, "Order not found");

  const uid = actor._id;
  const customerId = (order.customerId as unknown as { _id: unknown })._id;
  const vendorId = (order.vendorId as unknown as { _id: unknown })._id;
  if (
    actor.role !== "admin" &&
    String(customerId) !== uid &&
    String(vendorId) !== uid
  ) {
    throw new HttpError(403, "You do not have access to this order");
  }
  return order;
}
