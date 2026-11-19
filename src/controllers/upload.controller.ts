import type { Request, Response } from "express";
import { uploadImage } from "../services/upload.service.js";
import { sendSuccess } from "../utils/api-response.js";

export async function uploadSingleImage(req: Request, res: Response): Promise<void> {
  const result = await uploadImage(req.file!);
  sendSuccess(res, result, { status: 201 });
}
