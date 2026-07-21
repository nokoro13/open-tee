"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { registrations, events, registrationGroups } from "@/db/schema";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { getActiveEntryFee } from "@/lib/event-pricing";
import { isRegistrationFinalized } from "@/lib/event-workflow";
import { validateHandicapInput } from "@/lib/handicap-strokes";
import { canUseProFeature } from "@/lib/platform-tier";
import { syncRegistrationScoringCode } from "@/actions/scoring";
import { notifyWaitlistOnSpotOpen } from "@/actions/waitlist";
import { getEventFormatLabel } from "@/lib/event-formats";
import { requireOrganization } from "@/lib/auth";
import {
  getPublishedEventBySlug,
  getRegistrationCount,
  getPublicRegistrationMessage,
  isOperationalEventStatus,
  isRegistrationOpen,
} from "@/lib/events";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type RegistrationInput = {
  name: string;
  email: string;
  handicap?: string;
  phone?: string;
  smsOptIn?: boolean;
};

export type GroupPlayerInput = {
  name: string;
  email: string;
  handicap?: string;
};

export type GroupRegistrationInput = {
  leaderName: string;
  leaderEmail: string;
  phone?: string;
  smsOptIn?: boolean;
  players: GroupPlayerInput[];
};

export type UpdateRegistrationInput = {
  registrationId: string;
  eventId: string;
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

  const handicapResult = validateHandicapInput(input.handicap);
  if (!handicapResult.valid) {
    return { success: false, error: handicapResult.error };
  }

  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    handicap: handicapResult.value ?? undefined,
    phone: input.phone?.trim() || undefined,
    smsOptIn: input.smsOptIn ?? false,
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
    return {
      success: false,
      error: getPublicRegistrationMessage(event),
    };
  }

  const count = await getRegistrationCount(event.id);
  if (count >= event.maxPlayers) {
    if (canUseProFeature(event, "waitlist") && event.waitlistEnabled) {
      return {
        success: false,
        error: "WAITLIST",
      };
    }
    return { success: false, error: "This event is sold out." };
  }

  const pricing = getActiveEntryFee(event);

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

  if (event.entryFeeCents === 0 || pricing.feeCents === 0) {
    if (existing) {
      await getDb()
        .update(registrations)
        .set({
          name: parsed.name,
          handicap: parsed.handicap ?? null,
          phone: parsed.phone ?? null,
          smsOptIn: parsed.smsOptIn ?? false,
          paymentStatus: "comped",
          entryFeePaidCents: 0,
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, existing.id));
      await syncRegistrationScoringCode(existing.id);
    } else {
      const [registration] = await getDb()
        .insert(registrations)
        .values({
          eventId: event.id,
          name: parsed.name,
          email: parsed.email,
          handicap: parsed.handicap ?? null,
          phone: parsed.phone ?? null,
          smsOptIn: parsed.smsOptIn ?? false,
          paymentStatus: "comped",
          entryFeePaidCents: 0,
        })
        .returning({ id: registrations.id });
      if (registration) {
        await syncRegistrationScoringCode(registration.id);
      }
    }

    try {
      await sendRegistrationConfirmationEmail({
        to: parsed.email,
        playerName: parsed.name,
        eventName: event.name,
        eventDate: event.date,
        courseName: event.courseName,
        entryFeeCents: pricing.feeCents,
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
        phone: parsed.phone ?? null,
        smsOptIn: parsed.smsOptIn ?? false,
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
        phone: parsed.phone ?? null,
        smsOptIn: parsed.smsOptIn ?? false,
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
            description: pricing.isEarlyBird
              ? `${event.courseName} · Early bird pricing`
              : `${event.courseName} · ${getEventFormatLabel(event.format)}`,
          },
          unit_amount: pricing.feeCents,
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
      entryFeeCents: String(pricing.feeCents),
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

export async function updateRegistration(
  input: UpdateRegistrationInput
): Promise<ActionResult> {
  const parsed = parseRegistrationInput(input);
  if ("success" in parsed) {
    return parsed;
  }

  const org = await requireOrganization();

  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, input.registrationId),
    with: { event: true },
  });

  if (!registration || registration.eventId !== input.eventId) {
    return { success: false, error: "Registration not found." };
  }

  if (registration.event.orgId !== org.id) {
    return { success: false, error: "Registration not found." };
  }

  if (parsed.email !== registration.email) {
    const duplicate = await getDb().query.registrations.findFirst({
      where: and(
        eq(registrations.eventId, input.eventId),
        eq(registrations.email, parsed.email),
        ne(registrations.id, input.registrationId)
      ),
    });

    if (duplicate) {
      return {
        success: false,
        error: "Another registration already uses this email.",
      };
    }
  }

  await getDb()
    .update(registrations)
    .set({
      name: parsed.name,
      email: parsed.email,
      handicap: parsed.handicap ?? null,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, input.registrationId));

  revalidatePath(`/dashboard/events/${input.eventId}`);
  revalidatePath(`/print/events/${input.eventId}/scorecards`);

  return { success: true };
}

export async function compRegistration(
  registrationId: string,
  eventId: string
): Promise<ActionResult> {
  const org = await requireOrganization();

  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });

  if (!registration || registration.eventId !== eventId) {
    return { success: false, error: "Registration not found." };
  }

  if (registration.event.orgId !== org.id) {
    return { success: false, error: "Registration not found." };
  }

  if (!isOperationalEventStatus(registration.event.status)) {
    return {
      success: false,
      error: "Comp entries can only be added to live events.",
    };
  }

  if (registration.paymentStatus === "comped") {
    return { success: false, error: "This player is already comped." };
  }

  if (registration.paymentStatus === "paid") {
    return {
      success: false,
      error:
        "This player already paid. Issue a refund in Stripe, then comp or re-register them.",
    };
  }

  await getDb()
    .update(registrations)
    .set({
      paymentStatus: "comped",
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  await syncRegistrationScoringCode(registrationId);

  const event = registration.event;
  const appUrl = getAppUrl();

  try {
    await sendRegistrationConfirmationEmail({
      to: registration.email,
      playerName: registration.name,
      eventName: event.name,
      eventDate: event.date,
      courseName: event.courseName,
      entryFeeCents: 0,
      eventUrl: `${appUrl}/e/${event.slug}`,
    });
  } catch {
    // Non-fatal
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function addCompRegistration(
  eventId: string,
  input: RegistrationInput
): Promise<ActionResult> {
  const parsed = parseRegistrationInput(input);
  if ("success" in parsed) {
    return parsed;
  }

  const org = await requireOrganization();
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, org.id)),
  });

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  if (!isOperationalEventStatus(event.status)) {
    return { success: false, error: "Comp entries can only be added to live events." };
  }

  if (isRegistrationFinalized(event)) {
    return {
      success: false,
      error: "Registration is finalized. Reopen registration to add players.",
    };
  }

  const count = await getRegistrationCount(event.id);
  if (count >= event.maxPlayers) {
    return { success: false, error: "This event is at capacity." };
  }

  const existing = await getDb().query.registrations.findFirst({
    where: and(
      eq(registrations.eventId, event.id),
      eq(registrations.email, parsed.email)
    ),
  });

  if (existing) {
    return {
      success: false,
      error: "This email is already registered. Edit the existing registration instead.",
    };
  }

  const [registration] = await getDb()
    .insert(registrations)
    .values({
      eventId: event.id,
      name: parsed.name,
      email: parsed.email,
      handicap: parsed.handicap ?? null,
      paymentStatus: "comped",
    })
    .returning({ id: registrations.id });

  if (registration) {
    await syncRegistrationScoringCode(registration.id);
  }

  const appUrl = getAppUrl();

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
    // Non-fatal
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function registerGroupForEvent(
  slug: string,
  input: GroupRegistrationInput
): Promise<ActionResult> {
  const event = await getPublishedEventBySlug(slug);
  if (!event) {
    return { success: false, error: "Event not found or not accepting registrations." };
  }

  if (
    !canUseProFeature(event, "group_registration") ||
    !event.groupRegistrationEnabled
  ) {
    return { success: false, error: "Group registration is not available." };
  }

  if (!isRegistrationOpen(event)) {
    return { success: false, error: getPublicRegistrationMessage(event) };
  }

  const players = input.players.filter((p) => p.name.trim() && p.email.trim());
  if (players.length < 2) {
    return { success: false, error: "Add at least 2 players for group registration." };
  }
  if (players.length > event.maxGroupSize) {
    return {
      success: false,
      error: `Groups can include up to ${event.maxGroupSize} players.`,
    };
  }

  const emails = new Set(players.map((p) => p.email.trim().toLowerCase()));
  if (emails.size !== players.length) {
    return { success: false, error: "Each player needs a unique email." };
  }

  for (const player of players) {
    const handicapResult = validateHandicapInput(player.handicap);
    if (!handicapResult.valid) {
      return { success: false, error: handicapResult.error };
    }
  }

  const count = await getRegistrationCount(event.id);
  const spotsNeeded = players.length;
  if (count + spotsNeeded > event.maxPlayers) {
    if (canUseProFeature(event, "waitlist") && event.waitlistEnabled) {
      return { success: false, error: "WAITLIST" };
    }
    return { success: false, error: "Not enough spots left for this group." };
  }

  for (const player of players) {
    const existing = await getDb().query.registrations.findFirst({
      where: and(
        eq(registrations.eventId, event.id),
        eq(registrations.email, player.email.trim().toLowerCase())
      ),
    });
    if (existing && existing.paymentStatus !== "pending") {
      return {
        success: false,
        error: `${player.email} is already registered for this event.`,
      };
    }
  }

  const pricing = getActiveEntryFee(event);
  const appUrl = getAppUrl();
  const totalCents = pricing.feeCents * players.length;

  const [group] = await getDb()
    .insert(registrationGroups)
    .values({
      eventId: event.id,
      leaderName: input.leaderName.trim(),
      leaderEmail: input.leaderEmail.trim().toLowerCase(),
      paymentStatus: totalCents === 0 ? "comped" : "pending",
    })
    .returning({ id: registrationGroups.id });

  const registrationIds: string[] = [];

  for (const player of players) {
    const handicapResult = validateHandicapInput(player.handicap);
    const handicapValue = handicapResult.valid
      ? (handicapResult.value ?? null)
      : null;
    const [registration] = await getDb()
      .insert(registrations)
      .values({
        eventId: event.id,
        registrationGroupId: group.id,
        name: player.name.trim(),
        email: player.email.trim().toLowerCase(),
        handicap: handicapValue,
        phone: input.phone?.trim() || null,
        smsOptIn: input.smsOptIn ?? false,
        paymentStatus: totalCents === 0 ? "comped" : "pending",
        entryFeePaidCents: totalCents === 0 ? 0 : null,
      })
      .returning({ id: registrations.id });
    registrationIds.push(registration.id);
  }

  if (totalCents === 0) {
    for (const id of registrationIds) {
      await syncRegistrationScoringCode(id);
    }
    redirect(`/e/${slug}/success?free=1&group=1`);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${event.name} — Group entry (${players.length} players)`,
            description: pricing.isEarlyBird
              ? "Early bird group registration"
              : "Group registration",
          },
          unit_amount: pricing.feeCents,
        },
        quantity: players.length,
      },
    ],
    customer_email: input.leaderEmail.trim().toLowerCase(),
    metadata: {
      type: "group_registration",
      registrationGroupId: group.id,
      eventId: event.id,
      eventSlug: event.slug,
      entryFeeCents: String(pricing.feeCents),
    },
    success_url: `${appUrl}/e/${slug}/success?session_id={CHECKOUT_SESSION_ID}&group=1`,
    cancel_url: `${appUrl}/e/${slug}?canceled=1`,
  });

  if (!session.url) {
    return { success: false, error: "Could not start payment. Please try again." };
  }

  await getDb()
    .update(registrationGroups)
    .set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(registrationGroups.id, group.id));

  redirect(session.url);
}

export async function handleRegistrationPaid(
  registrationId: string | null,
  registrationGroupId: string | null,
  eventId: string,
  sessionId: string,
  paymentIntentId: string | null,
  amountTotalCents: number | null
) {
  const entryFeeFromMetadata = amountTotalCents;

  if (registrationGroupId) {
    const group = await getDb().query.registrationGroups.findFirst({
      where: eq(registrationGroups.id, registrationGroupId),
      with: {
        registrations: true,
        event: true,
      },
    });

    if (!group || group.eventId !== eventId || group.paymentStatus === "paid") {
      return;
    }

    const perPlayerFee =
      group.registrations.length > 0 && entryFeeFromMetadata != null
        ? Math.round(entryFeeFromMetadata / group.registrations.length)
        : group.event.entryFeeCents;

    await getDb()
      .update(registrationGroups)
      .set({
        paymentStatus: "paid",
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId,
        updatedAt: new Date(),
      })
      .where(eq(registrationGroups.id, registrationGroupId));

    for (const registration of group.registrations) {
      if (registration.paymentStatus === "paid") continue;

      await getDb()
        .update(registrations)
        .set({
          paymentStatus: "paid",
          entryFeePaidCents: perPlayerFee,
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: paymentIntentId,
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, registration.id));

      await syncRegistrationScoringCode(registration.id);

      try {
        await sendRegistrationConfirmationEmail({
          to: registration.email,
          playerName: registration.name,
          eventName: group.event.name,
          eventDate: group.event.date,
          courseName: group.event.courseName,
          entryFeeCents: perPlayerFee,
          eventUrl: `${getAppUrl()}/e/${group.event.slug}`,
        });
      } catch {
        // Non-fatal
      }
    }

    return;
  }

  if (!registrationId) return;

  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });

  if (!registration || registration.eventId !== eventId) return;
  if (registration.paymentStatus === "paid") return;

  const paidCents =
    entryFeeFromMetadata ??
    getActiveEntryFee(registration.event).feeCents;

  await getDb()
    .update(registrations)
    .set({
      paymentStatus: "paid",
      entryFeePaidCents: paidCents,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  await syncRegistrationScoringCode(registrationId);

  const event = registration.event;
  const appUrl = getAppUrl();

  try {
    await sendRegistrationConfirmationEmail({
      to: registration.email,
      playerName: registration.name,
      eventName: event.name,
      eventDate: event.date,
      courseName: event.courseName,
      entryFeeCents: paidCents,
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
  const registrationGroupId = session.metadata?.registrationGroupId;
  const eventId = session.metadata?.eventId;

  if (eventId) {
    await handleRegistrationPaid(
      registrationId ?? null,
      registrationGroupId ?? null,
      eventId,
      session.id,
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
      session.amount_total ?? null
    );
  }

  if (registrationGroupId) {
    return getDb().query.registrationGroups.findFirst({
      where: eq(registrationGroups.id, registrationGroupId),
      with: { event: true, registrations: true },
    });
  }

  if (!registrationId) return null;

  return getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });
}
