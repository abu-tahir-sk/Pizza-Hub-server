import { Router } from "express";
import { z } from "zod";
import { getStripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { verifyJWT, requireRole, type AuthedRequest } from "../middlewares/auth.middleware.js";
import { HttpError } from "../middlewares/error.middleware.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";

export const paymentRouter = Router();

const PREMIUM_PRICE = 29.99; // USD — used when STRIPE_PREMIUM_PRICE_ID is not configured

/* ─────────────── Stripe Checkout (vendor → Premium) ─────────────── */

/**
 * POST /api/payments/create-checkout-session
 * Creates a Stripe Checkout session for the LOGGED-IN vendor only.
 * `vendorId` is taken from the verified JWT — a client can never create
 * a subscription session for another vendor.
 */
paymentRouter.post(
  "/create-checkout-session",
  verifyJWT,
  requireRole("vendor"),
  async (req: AuthedRequest, res, next) => {
    try {
      const stripe = getStripe();
      const origin = env.CLIENT_URL;

      const unitAmount = Math.round(PREMIUM_PRICE * 100);
      const lineItem: Record<string, unknown> = {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: "PizzaHub Premium Subscription",
            description: "Unlimited active menu items, Premium badge & featured placement (30 days)",
          },
        },
      };
      if (env.STRIPE_PREMIUM_PRICE_ID) {
        delete lineItem.price_data;
        lineItem.price = env.STRIPE_PREMIUM_PRICE_ID;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [lineItem],
        customer_email: req.user!.email,
        // Trusted metadata — the webhook reads ownership from here, never from the client
        metadata: {
          vendorId: req.user!._id,
          plan: "premium",
          purpose: "vendor_subscription",
        },
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
      });

      // Record a pending transaction; it becomes `paid` ONLY via the verified webhook
      await Transaction.create({
        vendorId: req.user!._id,
        plan: "premium",
        amount: PREMIUM_PRICE,
        currency: "usd",
        stripeSessionId: session.id,
        status: "pending",
      });

      res.json({ success: true, data: { sessionId: session.id, url: session.url } });
    } catch (err) {
      next(err);
    }
  }
);

/* ─────────────────────── Read-only transaction endpoints ─────────────── */

/** GET /api/payments/my-transactions — vendor's own payments */
paymentRouter.get(
  "/my-transactions",
  verifyJWT,
  requireRole("vendor"),
  async (req: AuthedRequest, res, next) => {
    try {
      const transactions = await Transaction.find({ vendorId: req.user!._id }).sort({ createdAt: -1 });
      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payments/verify?session_id=...
 * Confirmation endpoint for the Payment Success page. It verifies the
 * session with Stripe directly and returns the recorded transaction.
 * NOTE: this does NOT activate premium — only the webhook does.
 */
paymentRouter.get("/verify", verifyJWT, async (req: AuthedRequest, res, next) => {
  try {
    const sessionId = z.string().min(1).parse(req.query.session_id);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.vendorId !== req.user!._id) {
      throw new HttpError(403, "You do not have access to this transaction");
    }

    const transaction = await Transaction.findOne({ stripeSessionId: sessionId });
    res.json({
      success: true,
      data: {
        paymentStatus: session.payment_status,
        transaction,
      },
    });
  } catch (err) {
    next(err);
  }
});
