import Stripe from "stripe";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error.middleware.js";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(
      503,
      "Stripe is not configured on the server. Please add STRIPE_SECRET_KEY in your server/.env file"
    );
  }
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripe;
}
