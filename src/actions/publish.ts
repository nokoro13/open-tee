"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events, organizations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import {
  BILLING_CURRENCY,
  getEventHostingFeeCents,
  getStripeEventPriceId,
} from "@/lib/billing";
import { sendPublishConfirmationEmail } from "@/lib/email";
import { canPublishWithoutEventFee } from "@/lib/subscription";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

function eventHostingLineItem(eventName: string) {
  const priceId = getStripeEventPriceId();
  if (priceId) {
    return { price: priceId, quantity: 1 };
  }

  return {
    price_data: {
      currency: BILLING_CURRENCY,
      product_data: {
        name: "OpenRound Event Hosting",
        description: `Publish "${eventName}" and open registration`,
      },
      unit_amount: getEventHostingFeeCents(),
    },
    quantity: 1,
  };
}

async function publishEventRecord(
  eventId: string,
  orgId: string,
  sessionId: string | null
) {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.orgId !== orgId) return;
  if (event.status === "published") return;

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      status: "published",
      platformTier: "pro",
      platformPaidAt: now,
      registrationOpens: event.registrationOpens ?? now,
      stripePlatformSessionId: sessionId,
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  const org = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  const appUrl = getAppUrl();
  if (org?.contactEmail) {
    try {
      await sendPublishConfirmationEmail({
        to: org.contactEmail,
        eventName: event.name,
        eventUrl: `${appUrl}/dashboard/events/${event.id}`,
        registrationUrl: `${appUrl}/e/${event.slug}`,
      });
    } catch {
      // Email failure should not block publish
    }
  }
}

export async function startPublishCheckout(eventId: string): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  if (event.status !== "draft") {
    return { success: false, error: "Only draft events can be published." };
  }

  if (canPublishWithoutEventFee(org)) {
    await publishEventRecord(event.id, org.id, null);
    redirect(`${getAppUrl()}/dashboard/events/${event.id}?published=1`);
  }

  const appUrl = getAppUrl();
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [eventHostingLineItem(event.name)],
    metadata: {
      type: "platform_fee",
      eventId: event.id,
      orgId: org.id,
    },
    customer_email: org.contactEmail ?? undefined,
    ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
    success_url: `${appUrl}/dashboard/events/${event.id}?published=1`,
    cancel_url: `${appUrl}/dashboard/events/${event.id}?publish_canceled=1`,
  });

  if (!session.url) {
    return { success: false, error: "Could not create checkout session." };
  }

  await getDb()
    .update(events)
    .set({
      stripePlatformSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  redirect(session.url);
}

export async function handlePlatformFeePaid(
  eventId: string,
  orgId: string,
  sessionId: string
) {
  await publishEventRecord(eventId, orgId, sessionId);
}

export async function syncPublishIfPaid(eventId: string) {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.status === "published" || !event.stripePlatformSessionId) {
    return event;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(
    event.stripePlatformSessionId
  );

  if (session.payment_status === "paid" && session.metadata?.orgId) {
    await handlePlatformFeePaid(
      eventId,
      session.metadata.orgId,
      session.id
    );
    return getDb().query.events.findFirst({
      where: eq(events.id, eventId),
    });
  }

  return event;
}
