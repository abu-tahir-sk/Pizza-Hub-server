import { getStripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";
import { HttpError } from "../middlewares/error.middleware.js";

const PREMIUM_PRICE = 29.99; // USD — used when STRIPE_PREMIUM_PRICE_ID is not configured
const PREMIUM_DURATION_DAYS = 30;

export interface PaymentActor {
  _id: string;
  email: string;
}

/**
 * Creates a Checkout session for the authenticated vendor only.
 * Ownership is written into trusted session metadata; the client cannot
 * influence it. Premium is activated by verified webhook or verified session sync.
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

export async function getMyTransactions(vendorId: string) {
  const transactions = await Transaction.find({ vendorId }).sort({ createdAt: -1 });

  // Sync recent pending transactions directly with Stripe API
  try {
    const stripe = getStripe();
    for (const tx of transactions.slice(0, 3)) {
      if (tx.status === "pending" && tx.stripeSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(tx.stripeSessionId);
          if (session.payment_status === "paid" || session.status === "complete") {
            tx.status = "paid";
            tx.amount = (session.amount_total ?? 0) / 100 || tx.amount;
            await tx.save();

            const expiresAt = new Date(Date.now() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);
            await User.findByIdAndUpdate(vendorId, {
              subscriptionPlan: "premium",
              subscriptionExpiresAt: expiresAt,
            });
          }
        } catch {
          // ignore session retrieval error
        }
      }
    }
  } catch {
    // ignore stripe API error
  }

  return transactions;
}

/**
 * Verifies the session with Stripe API and transitions transaction/user to paid/premium
 * if Stripe confirms payment.
 */
export async function verifyCheckoutSession(sessionId: string, actor: PaymentActor) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.vendorId !== actor._id) {
    throw new HttpError(403, "You do not have access to this transaction");
  }

  let transaction = await Transaction.findOne({ stripeSessionId: sessionId });

  // If the Stripe session is paid or complete, activate premium and update transaction
  if (session.payment_status === "paid" || session.status === "complete") {
    if (!transaction || transaction.status === "pending") {
      transaction = await Transaction.findOneAndUpdate(
        { stripeSessionId: sessionId },
        {
          $set: {
            status: "paid",
            amount: (session.amount_total ?? 0) / 100 || transaction?.amount || PREMIUM_PRICE,
            currency: session.currency ?? "usd",
          },
        },
        { new: true, upsert: false }
      );

      const expiresAt = new Date(Date.now() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(actor._id, {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
      });
      console.log(`Payment verified and premium activated for vendor ${actor._id} via session verification`);
    }
  }

  return { paymentStatus: session.payment_status, transaction };
}
