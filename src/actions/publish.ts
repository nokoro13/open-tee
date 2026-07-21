"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events, organizations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { sendPublishConfirmationEmail } from "@/lib/email";
import {
  getPlatformFeeCentsForTier,
  PLATFORM_TIER_LABELS,
  type PlatformTier,
} from "@/lib/platform-tier";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function startPublishCheckout(
  eventId: string,
  tier: PlatformTier = "starter"
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  if (event.status !== "draft") {
    return { success: false, error: "Only draft events can be published." };
  }

  const appUrl = getAppUrl();
  const stripe = getStripe();
  const feeCents = getPlatformFeeCentsForTier(tier);
  const tierLabel = PLATFORM_TIER_LABELS[tier];

  await getDb()
    .update(events)
    .set({
      platformTier: tier,
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `OpenRound ${tierLabel} — Event publish`,
            description: `Publish "${event.name}" and open registration`,
          },
          unit_amount: feeCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "platform_fee",
      eventId: event.id,
      orgId: org.id,
      platformTier: tier,
    },
    customer_email: org.contactEmail ?? undefined,
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
  sessionId: string,
  tier?: PlatformTier
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
      platformPaidAt: now,
      platformTier: tier ?? event.platformTier,
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
    const tier = session.metadata.platformTier as PlatformTier | undefined;
    await handlePlatformFeePaid(
      eventId,
      session.metadata.orgId,
      session.id,
      tier
    );
    return getDb().query.events.findFirst({
      where: eq(events.id, eventId),
    });
  }

  return event;
}
