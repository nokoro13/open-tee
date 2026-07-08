"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events, pairingGroups } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { assertEventSetupUnlocked } from "@/lib/event-setup-lock";
import {
  computeTeeTimeForGroup,
  type StartFormatSettings,
  validateStartFormatSettings,
} from "@/lib/start-format";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function syncTeeTimesForEvent(eventId: string): Promise<void> {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (
    !event ||
    event.startFormat !== "tee_times" ||
    !event.firstTeeTime ||
    event.teeTimeIntervalMinutes == null
  ) {
    return;
  }

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    orderBy: [asc(pairingGroups.sortOrder), asc(pairingGroups.createdAt)],
  });

  const now = new Date();

  for (const [index, group] of groups.entries()) {
    const teeTime = computeTeeTimeForGroup(
      event.firstTeeTime,
      event.teeTimeIntervalMinutes,
      index
    );

    await getDb()
      .update(pairingGroups)
      .set({
        teeTime,
        startingHole: null,
        updatedAt: now,
      })
      .where(eq(pairingGroups.id, group.id));
  }
}

export async function updateEventStartFormat(
  eventId: string,
  input: StartFormatSettings
): Promise<ActionResult> {
  await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  const lockResult = assertEventSetupUnlocked(event.scoringStatus);
  if (!lockResult.ok) {
    return { success: false, error: lockResult.error };
  }

  const validationError = validateStartFormatSettings(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  await getDb()
    .update(events)
    .set({
      startFormat: input.startFormat,
      shotgunStartTime:
        input.startFormat === "shotgun"
          ? input.shotgunStartTime?.trim() || null
          : null,
      firstTeeTime:
        input.startFormat === "tee_times"
          ? input.firstTeeTime?.trim() || null
          : null,
      teeTimeIntervalMinutes:
        input.startFormat === "tee_times"
          ? input.teeTimeIntervalMinutes
          : null,
      updatedAt: new Date(),
    })
    .where(and(eq(events.id, eventId), eq(events.orgId, event.orgId)));

  if (input.startFormat === "tee_times") {
    await syncTeeTimesForEvent(eventId);
  } else {
    await getDb()
      .update(pairingGroups)
      .set({ teeTime: null, updatedAt: new Date() })
      .where(eq(pairingGroups.eventId, eventId));
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function autoAssignShotgunHoles(
  eventId: string
): Promise<ActionResult> {
  await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  const lockResult = assertEventSetupUnlocked(event.scoringStatus);
  if (!lockResult.ok) {
    return { success: false, error: lockResult.error };
  }

  if (event.startFormat !== "shotgun") {
    return {
      success: false,
      error: "Auto-assign is only available for shotgun starts.",
    };
  }

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    orderBy: [asc(pairingGroups.sortOrder), asc(pairingGroups.createdAt)],
  });

  if (groups.length === 0) {
    return { success: false, error: "Add groups before assigning starting holes." };
  }

  const holeCount = event.holes === "9" ? 9 : 18;
  const now = new Date();

  for (const [index, group] of groups.entries()) {
    await getDb()
      .update(pairingGroups)
      .set({
        startingHole: (index % holeCount) + 1,
        teeTime: null,
        updatedAt: now,
      })
      .where(eq(pairingGroups.id, group.id));
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  return { success: true };
}
