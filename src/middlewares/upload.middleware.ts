import multer from "multer";
import { HttpError } from "./error.middleware.js";

/** Multipart image handling is a transport concern, so it lives in middleware. */
export const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new HttpError(400, "Only image files are allowed"));
  },
}).single("image");
