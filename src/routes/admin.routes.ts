import { Router } from "express";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { asyncRoute } from "../utils/async-handler.js";
import { blockStatusSchema, menuStatusSchema } from "../validators/admin.validator.js";
import * as adminController from "../controllers/admin.controller.js";

export const adminRouter = Router();

adminRouter.use(verifyJWT, requireRole("admin"));

adminRouter.get("/users", asyncRoute(adminController.listUsers));
adminRouter.get("/users/:id", asyncRoute(adminController.getUser));
adminRouter.patch(
  "/users/:id/block-status",
  validate({ body: blockStatusSchema }),
  asyncRoute(adminController.updateBlockStatus)
);

adminRouter.get("/menu-items", asyncRoute(adminController.listMenuItems));
adminRouter.patch(
  "/menu-items/:id/status",
  validate({ body: menuStatusSchema }),
  asyncRoute(adminController.updateMenuItemStatus)
);
adminRouter.delete("/menu-items/:id", asyncRoute(adminController.deleteMenuItem));

adminRouter.get("/transactions", asyncRoute(adminController.listTransactions));
adminRouter.get("/overview", asyncRoute(adminController.getOverview));
