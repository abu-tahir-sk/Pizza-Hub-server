import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import * as menuService from "../services/menu.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { routeParam } from "../utils/params.js";
import type { CreateItemInput, UpdateItemInput } from "../validators/menu.validator.js";

export async function listMenu(req: AuthedRequest, res: Response): Promise<void> {
  const { items, meta } = await menuService.listMenuItems(req.query);
  sendSuccess(res, items, { meta });
}

export async function getFeatured(_req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await menuService.getFeaturedMenu());
}

export async function getById(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await menuService.getMenuItemById(routeParam(req.params.id)));
}

export async function getMyItems(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await menuService.getVendorMenuItems(req.user!._id));
}

export async function createItem(req: AuthedRequest, res: Response): Promise<void> {
  const item = await menuService.createMenuItem(req.user!, req.body as CreateItemInput);
  sendSuccess(res, item, {
    status: 201,
    message:
      req.user?.role === "admin"
        ? "Menu item created and published"
        : "Menu item created — pending admin approval",
  });
}

export async function updateItem(req: AuthedRequest, res: Response): Promise<void> {
  const item = await menuService.updateMenuItem(
    routeParam(req.params.id),
    req.user!,
    req.body as UpdateItemInput
  );
  sendSuccess(res, item, { message: "Menu item updated" });
}

export async function deleteItem(req: AuthedRequest, res: Response): Promise<void> {
  await menuService.deleteMenuItem(routeParam(req.params.id), req.user!._id);
  sendSuccess(res, undefined, { message: "Menu item deleted" });
}
