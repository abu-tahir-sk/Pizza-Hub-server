import { Router, raw } from "express";
import { getStripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";

export const webhookRouter = Router();

const PREMIUM_DURATION_DAYS = 30;

/**
 * POST /api/payments/webhook
 * Mounted BEFORE express.json in app.ts so Stripe's raw body is intact
 * for signature verification. This is the ONLY place where a Premium
 * subscription is activated — the frontend success redirect is never trusted.
 */
webhookRouter.post(
  "/",
  raw({ type: "application/json" }),
  async (req, res, next) => {
    const stripe = getStripe();

    let event: import("stripe").Stripe.Event;
    try {
      const signature = req.headers["stripe-signature"];
      if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ success: false, message: "Missing Stripe signature" });
      }
      event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: "Webhook signature verification failed" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as import("stripe").Stripe.Checkout.Session;
          const vendorId = session.metadata?.vendorId;
          const purpose = session.metadata?.purpose;
          if (purpose === "vendor_subscription" && vendorId && session.status === "complete") {
            await Transaction.findOneAndUpdate(
              { stripeSessionId: session.id },
              {
                status: "paid",
                amount: (session.amount_total ?? 0) / 100,
                currency: session.currency ?? "usd",
              },
              { new: true }
            );

            const expiresAt = new Date(Date.now() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);
            await User.findByIdAndUpdate(vendorId, {
              subscriptionPlan: "premium",
              subscriptionExpiresAt: expiresAt,
            });
            console.log(`✅ Premium activated for vendor ${vendorId} until ${expiresAt.toISOString()}`);
          }
          break;
        }

        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          const session = event.data.object as import("stripe").Stripe.Checkout.Session;
          await Transaction.findOneAndUpdate(
            { stripeSessionId: session.id, status: "pending" },
            { status: event.type === "checkout.session.expired" ? "expired" : "failed" }
          );
          break;
        }
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  }
);
