import type { Request, Response } from "express";
import { constructWebhookEvent, handleStripeEvent } from "../services/webhook.service.js";
import { sendError } from "../utils/api-response.js";

/**
 * Stripe requires this exact unenveloped acknowledgement, so this is the one
 * endpoint that does not use the standard success envelope.
 */
export async function receiveStripeEvent(req: Request, res: Response): Promise<void> {
  let event;
  try {
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    event = constructWebhookEvent(rawBody, req.headers["stripe-signature"]);
  } catch {
    sendError(res, 400, "Webhook signature verification failed");
    return;
  }

  await handleStripeEvent(event);
  res.json({ received: true });
}
