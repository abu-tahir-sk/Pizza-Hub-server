import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import { validatedQuery } from "../middlewares/validate.middleware.js";
import * as paymentService from "../services/payment.service.js";
import { sendSuccess } from "../utils/api-response.js";
import type { VerifySessionQuery } from "../validators/payment.validator.js";

export async function createCheckout(req: AuthedRequest, res: Response): Promise<void> {
  const result = await paymentService.createCheckoutSession(req.user!);
  sendSuccess(res, result);
}

export async function getMyTransactions(req: AuthedRequest, res: Response): Promise<void> {
  sendSuccess(res, await paymentService.getMyTransactions(req.user!._id));
}

export async function verifySession(req: AuthedRequest, res: Response): Promise<void> {
  const query =
    validatedQuery<VerifySessionQuery>(res) ?? (req.query as VerifySessionQuery);
  const result = await paymentService.verifyCheckoutSession(query.session_id, req.user!);
  sendSuccess(res, result);
}
