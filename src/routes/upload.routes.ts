import { Router } from "express";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import { asyncRoute } from "../utils/async-handler.js";
import { uploadSingleImage as handleUpload } from "../controllers/upload.controller.js";

export const uploadRouter = Router();

uploadRouter.post(
  "/image",
  verifyJWT,
  requireRole("admin", "vendor", "customer"),
  uploadSingleImage,
  asyncRoute(handleUpload)
);
