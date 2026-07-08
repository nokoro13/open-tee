import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { events, organizations, registrations } from "@/db/schema";

export async function getPublishedEventBySlug(slug: string) {
  return getDb().query.events.findFirst({
    where: and(eq(events.slug, slug), eq(events.status, "published")),
    with: {
      organization: true,
    },
  });
}

export async function getRegistrationCount(eventId: string): Promise<number> {
  const [result] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, eventId),
        inArray(registrations.paymentStatus, ["paid", "pending", "comped"])
      )
    );

  return result?.count ?? 0;
}

export function isRegistrationOpen(event: {
  status: string;
  scoringStatus?: string;
  registrationOpens: Date | null;
  registrationCloses: Date | null;
}): boolean {
  if (event.status !== "published") return false;
  if (event.scoringStatus === "open" || event.scoringStatus === "finalized") {
    return false;
  }

  const now = new Date();
  if (event.registrationOpens && now < event.registrationOpens) return false;
  if (event.registrationCloses && now > event.registrationCloses) return false;

  return true;
}

export function getPublicRegistrationMessage(event: {
  scoringStatus: string;
  registrationOpens: Date | null;
  registrationCloses: Date | null;
  status: string;
}): string {
  if (event.scoringStatus === "open") {
    return "Registration is closed — the tournament is underway.";
  }
  if (event.scoringStatus === "finalized") {
    return "Registration is closed — this event has finished.";
  }
  if (!isRegistrationOpen(event)) {
    const now = new Date();
    if (event.registrationOpens && now < event.registrationOpens) {
      return "Registration is not open yet.";
    }
    if (event.registrationCloses && now > event.registrationCloses) {
      return "Registration is currently closed.";
    }
  }
  return "Complete the form below to secure your spot.";
}

export function formatEventDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatFee(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export async function getRegistrationsForEvent(eventId: string, orgId: string) {
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, orgId)),
  });

  if (!event) return [];

  return getDb().query.registrations.findMany({
    where: eq(registrations.eventId, eventId),
    orderBy: (registrations, { desc }) => [desc(registrations.createdAt)],
  });
}

export type PublicEvent = NonNullable<
  Awaited<ReturnType<typeof getPublishedEventBySlug>>
>;

export { organizations };
