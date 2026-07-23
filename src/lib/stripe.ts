import Stripe from "stripe";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to .env.local — see .env.example."
      );
    }
    stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  }
  return stripe;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
