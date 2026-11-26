import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import { exchangeSessionForJwt } from "../services/auth.service.js";
import { sendSuccess } from "../utils/api-response.js";

export async function exchangeToken(req: AuthedRequest, res: Response): Promise<void> {
  const queryToken =
    (typeof req.query?.session_token === "string" ? req.query.session_token : undefined) ||
    (typeof req.body?.session_token === "string" ? req.body.session_token : undefined) ||
    (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined) ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined);
  const result = await exchangeSessionForJwt(req.headers, queryToken);
  sendSuccess(res, result);
}
