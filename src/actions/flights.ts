"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { flights, pairingGroups, registrations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { canUseProFeature } from "@/lib/platform-tier";

export type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export async function getFlightsForEvent(eventId: string, orgId: string) {
  const event = await getEventById(eventId);
  if (!event || event.orgId !== orgId) return [];

  return getDb().query.flights.findMany({
    where: eq(flights.eventId, eventId),
    orderBy: (table, { asc }) => [asc(table.sortOrder)],
  });
}

export async function createFlight(
  eventId: string,
  name: string
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (!canUseProFeature(event, "multi_flight")) {
    return { success: false, error: "Flights require a Pro event." };
  }

  if (!name.trim()) {
    return { success: false, error: "Flight name is required." };
  }

  const existing = await getDb().query.flights.findMany({
    where: eq(flights.eventId, eventId),
  });

  const [created] = await getDb()
    .insert(flights)
    .values({
      eventId,
      name: name.trim(),
      sortOrder: existing.length,
    })
    .returning({ id: flights.id });

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true, id: created.id };
}

export async function deleteFlight(
  flightId: string,
  eventId: string
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  await getDb()
    .update(registrations)
    .set({ flightId: null, updatedAt: new Date() })
    .where(
      and(
        eq(registrations.eventId, eventId),
        eq(registrations.flightId, flightId)
      )
    );

  await getDb()
    .update(pairingGroups)
    .set({ flightId: null, updatedAt: new Date() })
    .where(
      and(
        eq(pairingGroups.eventId, eventId),
        eq(pairingGroups.flightId, flightId)
      )
    );

  await getDb()
    .delete(flights)
    .where(and(eq(flights.id, flightId), eq(flights.eventId, eventId)));

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}

export async function assignRegistrationFlight(
  registrationId: string,
  eventId: string,
  flightId: string | null
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (flightId) {
    const flight = await getDb().query.flights.findFirst({
      where: and(eq(flights.id, flightId), eq(flights.eventId, eventId)),
    });
    if (!flight) {
      return { success: false, error: "Flight not found." };
    }
  }

  await getDb()
    .update(registrations)
    .set({ flightId, updatedAt: new Date() })
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(registrations.eventId, eventId)
      )
    );

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}

export async function assignPairingGroupFlight(
  groupId: string,
  eventId: string,
  flightId: string | null
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (flightId) {
    const flight = await getDb().query.flights.findFirst({
      where: and(eq(flights.id, flightId), eq(flights.eventId, eventId)),
    });
    if (!flight) {
      return { success: false, error: "Flight not found." };
    }
  }

  await getDb()
    .update(pairingGroups)
    .set({ flightId, updatedAt: new Date() })
    .where(
      and(eq(pairingGroups.id, groupId), eq(pairingGroups.eventId, eventId))
    );

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}
