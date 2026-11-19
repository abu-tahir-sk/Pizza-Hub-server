import { Router } from "express";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncRoute } from "../utils/async-handler.js";
import { createItemSchema, updateItemSchema } from "../validators/menu.validator.js";
import * as menuController from "../controllers/menu.controller.js";

export const menuRouter = Router();

/* Public */
menuRouter.get("/", asyncRoute<AuthedRequest>(menuController.listMenu));
menuRouter.get("/featured", asyncRoute<AuthedRequest>(menuController.getFeatured));
menuRouter.get("/:id", asyncRoute<AuthedRequest>(menuController.getById));

/* Vendor */
menuRouter.get(
  "/vendor/my-items",
  verifyJWT,
  requireRole("vendor"),
  asyncRoute<AuthedRequest>(menuController.getMyItems)
);
menuRouter.post(
  "/",
  verifyJWT,
  requireRole("vendor"),
  validate({ body: createItemSchema }),
  asyncRoute<AuthedRequest>(menuController.createItem)
);
menuRouter.patch(
  "/:id",
  verifyJWT,
  requireRole("vendor"),
  validate({ body: updateItemSchema }),
  asyncRoute<AuthedRequest>(menuController.updateItem)
);
menuRouter.delete(
  "/:id",
  verifyJWT,
  requireRole("vendor"),
  asyncRoute<AuthedRequest>(menuController.deleteItem)
);
