import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import { exchangeSessionForJwt } from "../services/auth.service.js";
import { sendSuccess } from "../utils/api-response.js";

export async function exchangeToken(req: AuthedRequest, res: Response): Promise<void> {
  const result = await exchangeSessionForJwt(req.headers);
  sendSuccess(res, result);
}
