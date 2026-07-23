export const BILLING_CURRENCY = "cad" as const;

export const EVENT_HOSTING_FEE_CENTS = 19_900;
export const ANNUAL_COURSE_PLAN_FEE_CENTS = 250_000;

export const MAX_EVENT_PLAYERS = 10_000;

export function formatCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function getStripeEventPriceId(): string | undefined {
  return process.env.STRIPE_EVENT_PRICE_ID?.trim() || undefined;
}

export function getStripeAnnualPriceId(): string | undefined {
  return process.env.STRIPE_ANNUAL_PRICE_ID?.trim() || undefined;
}

export function getEventHostingFeeCents(): number {
  const envValue = process.env.STRIPE_EVENT_FEE_CENTS ?? process.env.STRIPE_PLATFORM_FEE_CENTS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return EVENT_HOSTING_FEE_CENTS;
}

export function getAnnualCoursePlanFeeCents(): number {
  const envValue =
    process.env.STRIPE_ANNUAL_FEE_CENTS ??
    process.env.STRIPE_ANNUAL_PLATFORM_FEE_CENTS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return ANNUAL_COURSE_PLAN_FEE_CENTS;
}
