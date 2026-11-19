import { Router, raw } from "express";
import { asyncRoute } from "../utils/async-handler.js";
import { receiveStripeEvent } from "../controllers/webhook.controller.js";

/** Raw body is required for Stripe signature verification. */
export const webhookRouter = Router();

webhookRouter.post("/", raw({ type: "application/json" }), asyncRoute(receiveStripeEvent));
