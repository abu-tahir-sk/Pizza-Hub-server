import type { Request, Response } from "express";
import * as adminService from "../services/admin.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { routeParam } from "../utils/params.js";
import type { BlockStatusInput, MenuStatusInput } from "../validators/admin.validator.js";

export async function listUsers(req: Request, res: Response): Promise<void> {
  const { users, meta } = await adminService.listUsers(req.query);
  sendSuccess(res, users, { meta });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await adminService.getUserById(routeParam(req.params.id)));
}

export async function updateBlockStatus(req: Request, res: Response): Promise<void> {
  const user = await adminService.setUserBlockStatus(
    routeParam(req.params.id),
    req.body as BlockStatusInput
  );
  sendSuccess(res, user, { message: `User ${user.isBlocked ? "blocked" : "unblocked"}` });
}

export async function listMenuItems(req: Request, res: Response): Promise<void> {
  const { items, meta } = await adminService.listMenuItems(req.query);
  sendSuccess(res, items, { meta });
}

export async function updateMenuItemStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as MenuStatusInput;
  const item = await adminService.setMenuItemStatus(routeParam(req.params.id), body);
  sendSuccess(res, item, { message: `Item status updated to ${body.status}` });
}

export async function deleteMenuItem(req: Request, res: Response): Promise<void> {
  await adminService.deleteMenuItem(routeParam(req.params.id));
  sendSuccess(res, undefined, { message: "Menu item deleted" });
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const { transactions, meta } = await adminService.listTransactions(req.query);
  sendSuccess(res, transactions, { meta });
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const { orders, meta } = await adminService.listOrders(req.query);
  sendSuccess(res, orders, { meta });
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as {
    status: "pending" | "accepted" | "rejected" | "cancelled";
  };
  const order = await adminService.setOrderStatus(routeParam(req.params.id), status);
  sendSuccess(res, order, { message: `Order status updated to ${status}` });
}

export async function getOverview(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await adminService.getOverview());
}
