import Stripe from "stripe";
import { env } from "../config/env.js";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error("Stripe is not configured on the server"), { status: 503 });
  }
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripe;
}
