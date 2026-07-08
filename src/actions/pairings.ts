"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import {
  ensurePairingGroupScoringCode,
  syncRegistrationScoringCode,
} from "@/actions/scoring";
import { syncTeeTimesForEvent } from "@/actions/start-format";
import { getDb } from "@/db";
import { pairingGroups, registrations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { assertEventSetupUnlocked } from "@/lib/event-setup-lock";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

async function requirePublishedEvent(
  eventId: string
): Promise<
  | { ok: true; event: NonNullable<Awaited<ReturnType<typeof getEventById>>> }
  | { ok: false; error: string }
> {
  await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { ok: false, error: "Event not found." };
  }

  if (event.status !== "published") {
    return {
      ok: false,
      error: "Pairings are only available for published events.",
    };
  }

  return { ok: true, event };
}

function assertSetupUnlocked(
  event: NonNullable<Awaited<ReturnType<typeof getEventById>>>
): ActionResult | null {
  const lockResult = assertEventSetupUnlocked(event.scoringStatus);
  if (!lockResult.ok) {
    return { success: false, error: lockResult.error };
  }
  return null;
}

export async function createPairingGroup(eventId: string): Promise<ActionResult> {
  const result = await requirePublishedEvent(eventId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const locked = assertSetupUnlocked(result.event);
  if (locked) return locked;

  const [countResult] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(pairingGroups)
    .where(eq(pairingGroups.eventId, eventId));

  const nextIndex = (countResult?.count ?? 0) + 1;

  const [inserted] = await getDb()
    .insert(pairingGroups)
    .values({
      eventId,
      label: `Group ${nextIndex}`,
      sortOrder: nextIndex - 1,
    })
    .returning({ id: pairingGroups.id });

  if (inserted) {
    await ensurePairingGroupScoringCode(inserted.id);
    await syncTeeTimesForEvent(eventId);
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}

export async function updatePairingGroup(
  groupId: string,
  input: {
    label?: string;
    teeTime?: string | null;
    startingHole?: number | null;
    matchType?: "singles" | "fourball" | "foursomes" | null;
  }
): Promise<ActionResult> {
  const org = await requireOrganization();

  const group = await getDb().query.pairingGroups.findFirst({
    where: eq(pairingGroups.id, groupId),
    with: { event: true },
  });

  if (!group || group.event.orgId !== org.id) {
    return { success: false, error: "Group not found." };
  }

  if (group.event.status !== "published") {
    return { success: false, error: "Pairings are only available for published events." };
  }

  const locked = assertSetupUnlocked(group.event);
  if (locked) return locked;

  const label = input.label?.trim();
  if (input.label !== undefined && !label) {
    return { success: false, error: "Group label is required." };
  }

  if (input.startingHole !== undefined && input.startingHole !== null) {
    const maxHole = group.event.holes === "9" ? 9 : 18;
    if (input.startingHole < 1 || input.startingHole > maxHole) {
      return { success: false, error: `Starting hole must be between 1 and ${maxHole}.` };
    }
  }

  await getDb()
    .update(pairingGroups)
    .set({
      ...(label !== undefined ? { label } : {}),
      ...(input.teeTime !== undefined
        ? { teeTime: input.teeTime?.trim() || null }
        : {}),
      ...(input.startingHole !== undefined
        ? { startingHole: input.startingHole }
        : {}),
      ...(input.matchType !== undefined ? { matchType: input.matchType } : {}),
      updatedAt: new Date(),
    })
    .where(eq(pairingGroups.id, groupId));

  revalidatePath(`/dashboard/events/${group.eventId}`);
  return { success: true };
}

export async function deletePairingGroup(groupId: string): Promise<ActionResult> {
  const org = await requireOrganization();

  const group = await getDb().query.pairingGroups.findFirst({
    where: eq(pairingGroups.id, groupId),
    with: { event: true },
  });

  if (!group || group.event.orgId !== org.id) {
    return { success: false, error: "Group not found." };
  }

  if (group.event.status !== "published") {
    return { success: false, error: "Pairings are only available for published events." };
  }

  const locked = assertSetupUnlocked(group.event);
  if (locked) return locked;

  await getDb().delete(pairingGroups).where(eq(pairingGroups.id, groupId));

  await syncTeeTimesForEvent(group.eventId);

  revalidatePath(`/dashboard/events/${group.eventId}`);
  return { success: true };
}

export async function assignRegistrationToGroup(
  registrationId: string,
  pairingGroupId: string | null
): Promise<ActionResult> {
  const org = await requireOrganization();

  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });

  if (!registration || registration.event.orgId !== org.id) {
    return { success: false, error: "Registration not found." };
  }

  if (registration.event.status !== "published") {
    return { success: false, error: "Pairings are only available for published events." };
  }

  const locked = assertSetupUnlocked(registration.event);
  if (locked) return locked;

  if (pairingGroupId) {
    const group = await getDb().query.pairingGroups.findFirst({
      where: and(
        eq(pairingGroups.id, pairingGroupId),
        eq(pairingGroups.eventId, registration.eventId)
      ),
    });

    if (!group) {
      return { success: false, error: "Group not found." };
    }
  }

  await getDb()
    .update(registrations)
    .set({
      pairingGroupId,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  await syncRegistrationScoringCode(registrationId);

  revalidatePath(`/dashboard/events/${registration.eventId}`);
  return { success: true };
}

export async function assignRegistrationTeamSide(
  registrationId: string,
  teamSide: "a" | "b" | null
): Promise<ActionResult> {
  const org = await requireOrganization();

  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });

  if (!registration || registration.event.orgId !== org.id) {
    return { success: false, error: "Registration not found." };
  }

  if (registration.event.status !== "published") {
    return { success: false, error: "Pairings are only available for published events." };
  }

  if (registration.event.format !== "ryder_cup") {
    return { success: false, error: "Team sides are only used for Ryder Cup events." };
  }

  const locked = assertSetupUnlocked(registration.event);
  if (locked) return locked;

  await getDb()
    .update(registrations)
    .set({
      teamSide,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registrationId));

  revalidatePath(`/dashboard/events/${registration.eventId}`);
  return { success: true };
}
