import type Stripe from "stripe";
import { getStripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";

const PREMIUM_DURATION_DAYS = 30;

/** Verify the raw body before trusting any event content. */
export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string | string[] | undefined
): Stripe.Event {
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Missing Stripe signature");
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Handles a verified Stripe event.
 *
 * Idempotency: the transaction is only moved from `pending` to `paid` once.
 * Premium is activated/extended only when that atomic update succeeds, so a
 * redelivered webhook cannot grant extra time.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const vendorId = session.metadata?.vendorId;
      const purpose = session.metadata?.purpose;
      if (purpose !== "vendor_subscription" || !vendorId || session.status !== "complete") {
        return;
      }

      const transitioned = await Transaction.findOneAndUpdate(
        { stripeSessionId: session.id, status: "pending" },
        {
          $set: {
            status: "paid",
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency ?? "usd",
          },
        },
        { new: true }
      );
      if (!transitioned) return; // already processed — redelivery

      const expiresAt = new Date(Date.now() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(vendorId, {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
      });
      console.log(`✅ Premium activated for vendor ${vendorId} until ${expiresAt.toISOString()}`);
      return;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await Transaction.findOneAndUpdate(
        { stripeSessionId: session.id, status: "pending" },
        { $set: { status: event.type === "checkout.session.expired" ? "expired" : "failed" } }
      );
      return;
    }

    default:
      return;
  }
}
