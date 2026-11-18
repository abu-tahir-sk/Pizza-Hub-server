import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { verifyJWT, requireRole } from "../middlewares/auth.middleware.js";
import { HttpError } from "../middlewares/error.middleware.js";

export const uploadRouter = Router();

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new HttpError(400, "Only image files are allowed"));
  },
});

/**
 * POST /api/uploads/image (multipart/form-data, field: `image`)
 * Proxies the upload to ImgBB so the API key never reaches the client.
 */
uploadRouter.post(
  "/image",
  verifyJWT,
  requireRole("vendor", "customer"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!env.IMGBB_API_KEY) throw new HttpError(503, "Image upload service is not configured");
      if (!req.file) throw new HttpError(400, "No image file provided");

      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), req.file.originalname || "upload.png");

      const response = await fetch(`${IMGBB_ENDPOINT}?key=${env.IMGBB_API_KEY}`, {
        method: "POST",
        body: form,
      });

      const result = (await response.json()) as {
        success: boolean;
        data?: { url: string; display_url: string };
        error?: { message: string };
      };

      if (!result.success || !result.data) {
        throw new HttpError(502, result.error?.message ?? "Image upload failed");
      }

      res.status(201).json({ success: true, data: { url: result.data.display_url ?? result.data.url } });
    } catch (err) {
      next(err);
    }
  }
);
