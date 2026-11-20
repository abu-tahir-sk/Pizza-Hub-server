import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error.middleware.js";

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface ImgBbResponse {
  success: boolean;
  data?: { url: string; display_url: string };
  error?: { message: string; code?: number };
}

/**
 * Uploads to ImgBB when available.
 * If ImgBB fails (key banned, quota exhausted, network block, or service error),
 * smoothly falls back to local static file storage in public/uploads so user uploads
 * never fail.
 */
export async function uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
  if (!file) throw new HttpError(400, "No image file provided");
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(400, "Only JPEG, PNG, WebP or GIF images are allowed");
  }

  // 1. Try ImgBB if key is configured
  if (env.IMGBB_API_KEY) {
    try {
      const form = new FormData();
      form.append(
        "image",
        new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
        file.originalname || "upload.png"
      );

      const response = await fetch(`${IMGBB_ENDPOINT}?key=${encodeURIComponent(env.IMGBB_API_KEY)}`, {
        method: "POST",
        body: form,
      });

      const result = (await response.json().catch(() => null)) as ImgBbResponse | null;
      if (result?.success && result.data?.url) {
        return { url: result.data.display_url ?? result.data.url };
      }
      console.warn("⚠️ ImgBB API error, falling back to local storage:", result?.error?.message ?? response.statusText);
    } catch (err: any) {
      console.warn("⚠️ ImgBB request failed, falling back to local storage:", err?.message);
    }
  }

  // 2. Resilient local fallback: Save to public/uploads
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = file.mimetype.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const filePath = path.join(uploadDir, uniqueName);

  await fs.writeFile(filePath, file.buffer);

  const baseUrl = env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`;
  return { url: `${baseUrl}/uploads/${uniqueName}` };
}
