"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type Stripe from "stripe";

import { getDb } from "@/db";
import { organizations, type Organization } from "@/db/schema";
import { requireOrganization, getOrganizationForUser, requireUserId } from "@/lib/auth";
import {
  BILLING_CURRENCY,
  getAnnualCoursePlanFeeCents,
  getStripeAnnualPriceId,
} from "@/lib/billing";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

function annualLineItem() {
  const priceId = getStripeAnnualPriceId();
  if (priceId) {
    return { price: priceId, quantity: 1 };
  }

  return {
    price_data: {
      currency: BILLING_CURRENCY,
      product_data: {
        name: "OpenRound Course Plan",
        description: "Unlimited events per year on OpenRound",
      },
      unit_amount: getAnnualCoursePlanFeeCents(),
      recurring: { interval: "year" as const },
    },
    quantity: 1,
  };
}

export async function startAnnualSubscriptionCheckout(
  returnEventId?: string
): Promise<ActionResult> {
  const org = await requireOrganization();
  const appUrl = getAppUrl();
  const stripe = getStripe();

  const publishReturnUrl = returnEventId
    ? `${appUrl}/dashboard/events/${returnEventId}?tab=publish&subscribed=1`
    : `${appUrl}/dashboard/settings?subscribed=1`;

  const publishCancelUrl = returnEventId
    ? `${appUrl}/dashboard/events/${returnEventId}?tab=publish&subscribe_canceled=1`
    : `${appUrl}/dashboard/settings?subscribe_canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [annualLineItem()],
    metadata: {
      type: "course_subscription",
      orgId: org.id,
      ...(returnEventId ? { returnEventId } : {}),
    },
    subscription_data: {
      metadata: {
        orgId: org.id,
      },
    },
    customer_email: org.contactEmail ?? undefined,
    ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
    success_url: publishReturnUrl,
    cancel_url: publishCancelUrl,
  });

  if (!session.url) {
    return { success: false, error: "Could not create checkout session." };
  }

  redirect(session.url);
}

export async function createBillingPortalSession(): Promise<ActionResult> {
  const org = await requireOrganization();

  if (!org.stripeCustomerId) {
    return {
      success: false,
      error: "No billing account found. Subscribe to the annual plan first.",
    };
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${getAppUrl()}/dashboard/settings`,
  });

  redirect(session.url);
}

export async function syncOrganizationSubscriptionFromStripe(
  subscription: Stripe.Subscription
) {
  const orgId = subscription.metadata?.orgId;
  if (!orgId) return;

  const org = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) return;

  await applySubscriptionToOrganization(org, subscription);
}

export async function syncOrganizationSubscriptionById(subscriptionId: string) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncOrganizationSubscriptionFromStripe(subscription);
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

async function applySubscriptionToOrganization(
  org: Organization,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const periodEndSeconds = getSubscriptionPeriodEnd(subscription);

  await getDb()
    .update(organizations)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as Organization["subscriptionStatus"],
      subscriptionCurrentPeriodEnd: periodEndSeconds
        ? new Date(periodEndSeconds * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));
}

export async function handleCourseSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const orgId = session.metadata?.orgId;
  if (!orgId) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const org = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const periodEndSeconds = getSubscriptionPeriodEnd(subscription);

  await getDb()
    .update(organizations)
    .set({
      stripeCustomerId: customerId ?? org.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as Organization["subscriptionStatus"],
      subscriptionCurrentPeriodEnd: periodEndSeconds
        ? new Date(periodEndSeconds * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}

export async function syncCurrentOrganizationSubscription(): Promise<Organization> {
  const org = await requireOrganization();
  const stripe = getStripe();

  if (org.stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    await applySubscriptionToOrganization(org, subscription);
    const refreshed = await getOrganizationForUser(await requireUserId());
    return refreshed ?? org;
  }

  if (org.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripeCustomerId,
      limit: 10,
    });
    const subscription = subscriptions.data.find(
      (item) => item.status === "active" || item.status === "trialing"
    );
    if (subscription) {
      await applySubscriptionToOrganization(org, subscription);
      const refreshed = await getOrganizationForUser(await requireUserId());
      return refreshed ?? org;
    }
  }

  return org;
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const org = await getDb().query.organizations.findFirst({
    where: eq(organizations.stripeSubscriptionId, subscription.id),
  });
  if (!org) return;

  await getDb()
    .update(organizations)
    .set({
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      subscriptionCurrentPeriodEnd: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));
}
