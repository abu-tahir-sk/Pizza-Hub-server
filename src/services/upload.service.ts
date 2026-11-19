import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error.middleware.js";

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface ImgBbResponse {
  success: boolean;
  data?: { url: string; display_url: string };
  error?: { message: string };
}

/**
 * Proxies image uploads to ImgBB so the API key never reaches the browser.
 */
export async function uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
  if (!env.IMGBB_API_KEY) {
    throw new HttpError(503, "Image upload service is not configured");
  }
  if (!file) throw new HttpError(400, "No image file provided");
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(400, "Only JPEG, PNG, WebP or GIF images are allowed");
  }

  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
    file.originalname || "upload.png"
  );

  let response: Response;
  try {
    response = await fetch(`${IMGBB_ENDPOINT}?key=${encodeURIComponent(env.IMGBB_API_KEY)}`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new HttpError(502, "Image upload service is unavailable");
  }

  const result = (await response.json().catch(() => null)) as ImgBbResponse | null;
  if (!result?.success || !result.data) {
    throw new HttpError(502, result?.error?.message ?? "Image upload failed");
  }

  return { url: result.data.display_url ?? result.data.url };
}
