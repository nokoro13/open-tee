"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { registrations } from "@/db/schema";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { getEventFormatLabel } from "@/lib/event-formats";
import {
  getPublishedEventBySlug,
  getRegistrationCount,
  isRegistrationOpen,
} from "@/lib/events";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type RegistrationInput = {
  name: string;
  email: string;
  handicap?: string;
};

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

function parseRegistrationInput(
  input: RegistrationInput
): RegistrationInput | ActionResult {
  if (!input.name.trim()) {
    return { success: false, error: "Name is required." };
  }
  if (!input.email.trim() || !input.email.includes("@")) {
    return { success: false, error: "A valid email is required." };
  }
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    handicap: input.handicap?.trim() || undefined,
  };
}

export async function registerForEvent(
  slug: string,
  input: RegistrationInput
): Promise<ActionResult> {
  const parsed = parseRegistrationInput(input);
  if ("success" in parsed) {
    return parsed;
  }

  const event = await getPublishedEventBySlug(slug);
  if (!event) {
    return { success: false, error: "Event not found or not accepting registrations." };
  }

  if (!isRegistrationOpen(event)) {
    return { success: false, error: "Registration is closed for this event." };
  }

  const count = await getRegistrationCount(event.id);
  if (count >= event.maxPlayers) {
    return { success: false, error: "This event is sold out." };
  }

  const existing = await getDb().query.registrations.findFirst({
    where: and(
      eq(registrations.eventId, event.id),
      eq(registrations.email, parsed.email)
    ),
  });

  if (existing && existing.paymentStatus !== "pending") {
    return {
      success: false,
      error: "This email is already registered for this event.",
    };
  }

  const appUrl = getAppUrl();

  if (event.entryFeeCents === 0) {
    if (existing) {
      await getDb()
        .update(registrations)
        .set({
          name: parsed.name,
          handicap: parsed.handicap ?? null,
          paymentStatus: "comped",
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, existing.id));
    } else {
      await getDb().insert(registrations).values({
        eventId: event.id,
        name: parsed.name,
        email: parsed.email,
        handicap: parsed.handicap ?? null,
        paymentStatus: "comped",
      });
    }

    try {
      await sendRegistrationConfirmationEmail({
        to: parsed.email,
        playerName: parsed.name,
        eventName: event.name,
        eventDate: event.date,
        courseName: event.courseName,
        entryFeeCents: 0,
        eventUrl: `${appUrl}/e/${event.slug}`,
      });
    } catch {
      // Continue even if email fails
    }

    redirect(`/e/${slug}/success?free=1`);
  }

  let registrationId = existing?.id;

  if (existing) {
    await getDb()
      .update(registrations)
      .set({
        name: parsed.name,
        handicap: parsed.handicap ?? null,
        paymentStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, existing.id));
  } else {
    const [registration] = await getDb()
      .insert(registrations)
      .values({
        eventId: event.id,
        name: parsed.name,
        email: parsed.email,
        handicap: parsed.handicap ?? null,
        paymentStatus: "pending",
      })
      .returning();
    registrationId = registration.id;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${event.name} — Entry fee`,
            description: `${event.courseName} · ${getEventFormatLabel(event.format)}`,
          },
          unit_amount: event.entryFeeCents,
        },
        quantity: 1,
      },
    ],
    customer_email: parsed.email,
    metadata: {
      type: "registration",
      registrationId: registrationId!,
      eventId: event.id,
      eventSlug: event.slug,
    },
    success_url: `${appUrl}/e/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/e/${slug}?canceled=1`,
  });

  if (!session.url) {
    return { success: false, error: "Could not start payment. Please try again." };
  }

  await getDb()
    .update(registrations)
    .set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId!));

  redirect(session.url);
}

export async function handleRegistrationPaid(
  registrationId: string,
  eventId: string,
  sessionId: string,
  paymentIntentId: string | null
) {
  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });

  if (!registration || registration.eventId !== eventId) return;
  if (registration.paymentStatus === "paid") return;

  await getDb()
    .update(registrations)
    .set({
      paymentStatus: "paid",
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  const event = registration.event;
  const appUrl = getAppUrl();

  try {
    await sendRegistrationConfirmationEmail({
      to: registration.email,
      playerName: registration.name,
      eventName: event.name,
      eventDate: event.date,
      courseName: event.courseName,
      entryFeeCents: event.entryFeeCents,
      eventUrl: `${appUrl}/e/${event.slug}`,
    });
  } catch {
    // Payment succeeded; email failure is non-fatal
  }
}

export async function verifyRegistrationSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return null;
  }

  const registrationId = session.metadata?.registrationId;
  const eventId = session.metadata?.eventId;

  if (registrationId && eventId) {
    await handleRegistrationPaid(
      registrationId,
      eventId,
      session.id,
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null
    );
  }

  if (!registrationId) return null;

  return getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });
}
