import { Router } from "express";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncRoute } from "../utils/async-handler.js";
import { verifySessionQuerySchema } from "../validators/payment.validator.js";
import * as paymentController from "../controllers/payment.controller.js";

export const paymentRouter = Router();

paymentRouter.post(
  "/create-checkout-session",
  verifyJWT,
  requireRole("vendor"),
  asyncRoute<AuthedRequest>(paymentController.createCheckout)
);
paymentRouter.get(
  "/my-transactions",
  verifyJWT,
  requireRole("vendor"),
  asyncRoute<AuthedRequest>(paymentController.getMyTransactions)
);
paymentRouter.get(
  "/verify",
  verifyJWT,
  validate({ query: verifySessionQuerySchema }),
  asyncRoute<AuthedRequest>(paymentController.verifySession)
);
