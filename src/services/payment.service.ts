import { getStripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { Transaction } from "../models/transaction.model.js";
import { HttpError } from "../middlewares/error.middleware.js";

const PREMIUM_PRICE = 29.99; // USD — used when STRIPE_PREMIUM_PRICE_ID is not configured

export interface PaymentActor {
  _id: string;
  email: string;
}

/**
 * Creates a Checkout session for the authenticated vendor only.
 * Ownership is written into trusted session metadata; the client cannot
 * influence it. Premium is activated exclusively by the verified webhook.
 */
export async function createCheckoutSession(actor: PaymentActor) {
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
    customer_email: actor.email,
    metadata: {
      vendorId: actor._id,
      plan: "premium",
      purpose: "vendor_subscription",
    },
    success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/payment/cancel`,
  });

  await Transaction.create({
    vendorId: actor._id,
    plan: "premium",
    amount: PREMIUM_PRICE,
    currency: "usd",
    stripeSessionId: session.id,
    status: "pending",
  });

  return { sessionId: session.id, url: session.url };
}

export function getMyTransactions(vendorId: string) {
  return Transaction.find({ vendorId }).sort({ createdAt: -1 });
}

/**
 * Read-only confirmation for the success page. Never activates premium.
 */
export async function verifyCheckoutSession(sessionId: string, actor: PaymentActor) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.vendorId !== actor._id) {
    throw new HttpError(403, "You do not have access to this transaction");
  }

  const transaction = await Transaction.findOne({ stripeSessionId: sessionId });
  return { paymentStatus: session.payment_status, transaction };
}
