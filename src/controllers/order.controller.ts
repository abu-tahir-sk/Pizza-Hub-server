import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import * as orderService from "../services/order.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { routeParam } from "../utils/params.js";
import type { CreateOrderInput, DecideOrderInput } from "../validators/order.validator.js";

export async function getMyOrders(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await orderService.getCustomerOrders(req.user!._id));
}

export async function placeOrder(req: AuthedRequest, res: Response): Promise<void> {
  const order = await orderService.createOrder(req.user!._id, req.body as CreateOrderInput);
  sendSuccess(res, order, { status: 201, message: "Order placed successfully" });
}

export async function cancelOrder(req: AuthedRequest, res: Response): Promise<void> {
  const order = await orderService.cancelOrder(routeParam(req.params.id), req.user!._id);
  sendSuccess(res, order, { message: "Order cancelled" });
}

export async function getVendorOrders(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await orderService.getVendorOrders(req.user!._id));
}

export async function decideOrder(req: AuthedRequest, res: Response): Promise<void> {
  const status = (req.body as DecideOrderInput).status;
  const order = await orderService.decideOrder(routeParam(req.params.id), req.user!._id, { status });
  sendSuccess(res, order, { message: `Order ${status}` });
}

export async function getStats(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await orderService.getOrderStats(req.user!));
}

export async function getById(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await orderService.getOrderById(routeParam(req.params.id), req.user!));
}
