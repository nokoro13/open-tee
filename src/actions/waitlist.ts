"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { events, waitlistEntries } from "@/db/schema";
import { sendWaitlistSpotAvailableEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";
import { sendWaitlistSpotAvailableSms } from "@/lib/sms";
import { canUseProFeature } from "@/lib/platform-tier";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export type WaitlistInput = {
  name: string;
  email: string;
  phone?: string;
};

function parseWaitlistInput(input: WaitlistInput): WaitlistInput | ActionResult {
  if (!input.name.trim()) {
    return { success: false, error: "Name is required." };
  }
  if (!input.email.trim() || !input.email.includes("@")) {
    return { success: false, error: "A valid email is required." };
  }

  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || undefined,
  };
}

export async function joinWaitlist(
  slug: string,
  input: WaitlistInput
): Promise<ActionResult> {
  const parsed = parseWaitlistInput(input);
  if ("success" in parsed) return parsed;

  const event = await getDb().query.events.findFirst({
    where: and(eq(events.slug, slug), eq(events.status, "published")),
  });

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  if (!canUseProFeature(event, "waitlist") || !event.waitlistEnabled) {
    return { success: false, error: "Waitlist is not available for this event." };
  }

  const existing = await getDb().query.waitlistEntries.findFirst({
    where: and(
      eq(waitlistEntries.eventId, event.id),
      eq(waitlistEntries.email, parsed.email)
    ),
  });

  if (existing) {
    return { success: false, error: "You are already on the waitlist." };
  }

  await getDb().insert(waitlistEntries).values({
    eventId: event.id,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone ?? null,
  });

  revalidatePath(`/dashboard/events/${event.id}`);
  return { success: true };
}

export async function notifyWaitlistOnSpotOpen(eventId: string) {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (
    !event ||
    !canUseProFeature(event, "waitlist") ||
    !event.waitlistEnabled
  ) {
    return;
  }

  const next = await getDb().query.waitlistEntries.findFirst({
    where: and(
      eq(waitlistEntries.eventId, eventId),
      isNull(waitlistEntries.notifiedAt)
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  if (!next) return;

  const appUrl = getAppUrl();
  const eventUrl = `${appUrl}/e/${event.slug}`;

  try {
    await sendWaitlistSpotAvailableEmail({
      to: next.email,
      playerName: next.name,
      eventName: event.name,
      eventUrl,
    });
  } catch {
    // Continue to SMS attempt
  }

  if (next.phone) {
    await sendWaitlistSpotAvailableSms({
      to: next.phone,
      playerName: next.name,
      eventName: event.name,
      eventUrl,
    });
  }

  await getDb()
    .update(waitlistEntries)
    .set({ notifiedAt: new Date() })
    .where(eq(waitlistEntries.id, next.id));
}

export async function getWaitlistForEvent(eventId: string, orgId: string) {
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
  });

  if (!event) return [];

  return getDb().query.waitlistEntries.findMany({
    where: eq(waitlistEntries.eventId, eventId),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
}

export async function removeWaitlistEntry(
  entryId: string,
  eventId: string
): Promise<ActionResult> {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  await getDb()
    .delete(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        eq(waitlistEntries.eventId, eventId)
      )
    );

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}
