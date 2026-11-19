import { Router } from "express";
import { asyncRoute } from "../utils/async-handler.js";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import { exchangeToken } from "../controllers/auth.controller.js";

/** POST /api/auth-extra/token — Better Auth session → PizzaHub JWT. */
export const authRouter = Router();

authRouter.post("/token", asyncRoute<AuthedRequest>(exchangeToken));
