import { Router } from "express";
import { verifyJWT, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncRoute } from "../utils/async-handler.js";
import { updateProfileSchema } from "../validators/user.validator.js";
import * as userController from "../controllers/user.controller.js";

export const userRouter = Router();

userRouter.get("/me", verifyJWT, asyncRoute<AuthedRequest>(userController.getMe));
userRouter.patch(
  "/me",
  verifyJWT,
  validate({ body: updateProfileSchema }),
  asyncRoute<AuthedRequest>(userController.updateMe)
);
