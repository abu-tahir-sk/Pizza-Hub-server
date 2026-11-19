import { Router } from "express";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncRoute } from "../utils/async-handler.js";
import { createOrderSchema, decideOrderSchema } from "../validators/order.validator.js";
import * as orderController from "../controllers/order.controller.js";

export const orderRouter = Router();

/* Customer */
orderRouter.get(
  "/my",
  verifyJWT,
  requireRole("customer"),
  asyncRoute<AuthedRequest>(orderController.getMyOrders)
);
orderRouter.post(
  "/",
  verifyJWT,
  requireRole("customer"),
  validate({ body: createOrderSchema }),
  asyncRoute<AuthedRequest>(orderController.placeOrder)
);
orderRouter.patch(
  "/:id/cancel",
  verifyJWT,
  requireRole("customer"),
  asyncRoute<AuthedRequest>(orderController.cancelOrder)
);

/* Vendor */
orderRouter.get(
  "/vendor",
  verifyJWT,
  requireRole("vendor"),
  asyncRoute<AuthedRequest>(orderController.getVendorOrders)
);
orderRouter.patch(
  "/:id/decision",
  verifyJWT,
  requireRole("vendor"),
  validate({ body: decideOrderSchema }),
  asyncRoute<AuthedRequest>(orderController.decideOrder)
);

/* Shared */
orderRouter.get("/stats", verifyJWT, asyncRoute<AuthedRequest>(orderController.getStats));
orderRouter.get("/:id", verifyJWT, asyncRoute<AuthedRequest>(orderController.getById));
