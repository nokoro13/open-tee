"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { getRegistrationCount } from "@/lib/events";
import {
  buildEventWorkflowSnapshot,
  isPairingsFinalized,
  isRegistrationFinalized,
  validatePairingsForFormat,
} from "@/lib/event-workflow";
import { getEventPairings } from "@/lib/pairings";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireWorkflowEvent(eventId: string) {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { ok: false as const, error: "Event not found." };
  }

  if (event.status === "draft" || event.status === "archived") {
    return {
      ok: false as const,
      error: "Workflow steps are only available for live events.",
    };
  }

  return { ok: true as const, event, org };
}

export async function finalizeRegistration(
  eventId: string
): Promise<ActionResult> {
  const result = await requireWorkflowEvent(eventId);
  if (!result.ok) return { success: false, error: result.error };

  const { event } = result;

  if (isRegistrationFinalized(event)) {
    return { success: false, error: "Registration is already finalized." };
  }

  if (event.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Registration cannot be changed after scoring has started.",
    };
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      registrationFinalizedAt: now,
      registrationCloses: event.registrationCloses ?? now,
      status: "closed",
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  revalidatePaths(eventId, event.slug);
  return { success: true };
}

export async function reopenRegistrationWorkflow(
  eventId: string
): Promise<ActionResult> {
  const result = await requireWorkflowEvent(eventId);
  if (!result.ok) return { success: false, error: result.error };

  const { event } = result;

  if (!isRegistrationFinalized(event)) {
    return { success: false, error: "Registration is still open." };
  }

  if (isPairingsFinalized(event)) {
    return {
      success: false,
      error: "Reopen registration before undoing finalized pairings.",
    };
  }

  if (event.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Cannot reopen registration after scoring has started.",
    };
  }

  await getDb()
    .update(events)
    .set({
      registrationFinalizedAt: null,
      status: "published",
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  revalidatePaths(eventId, event.slug);
  return { success: true };
}

export async function finalizePairings(eventId: string): Promise<ActionResult> {
  const result = await requireWorkflowEvent(eventId);
  if (!result.ok) return { success: false, error: result.error };

  const { event, org } = result;

  if (isPairingsFinalized(event)) {
    return { success: false, error: "Pairings are already finalized." };
  }

  if (event.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Pairings are locked while scoring is active.",
    };
  }

  const pairings = await getEventPairings(eventId, org.id);
  if (!pairings) {
    return { success: false, error: "Could not load pairings." };
  }

  const issues = validatePairingsForFormat(event.format, pairings);
  if (issues.length > 0) {
    return {
      success: false,
      error: issues[0],
    };
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      pairingsFinalizedAt: now,
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  revalidatePaths(eventId, event.slug);
  return { success: true };
}

export async function reopenPairings(eventId: string): Promise<ActionResult> {
  const result = await requireWorkflowEvent(eventId);
  if (!result.ok) return { success: false, error: result.error };

  const { event } = result;

  if (!isPairingsFinalized(event)) {
    return { success: false, error: "Pairings are not finalized." };
  }

  if (event.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Cannot edit pairings after scoring has started.",
    };
  }

  await getDb()
    .update(events)
    .set({
      pairingsFinalizedAt: null,
      scorecardsReadyAt: null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  revalidatePaths(eventId, event.slug);
  return { success: true };
}

export async function markScorecardsReady(
  eventId: string
): Promise<ActionResult> {
  const result = await requireWorkflowEvent(eventId);
  if (!result.ok) return { success: false, error: result.error };

  const { event } = result;

  if (!isPairingsFinalized(event)) {
    return {
      success: false,
      error: "Finalize pairings before marking scorecards ready.",
    };
  }

  if (event.scorecardsReadyAt) {
    return { success: false, error: "Scorecards are already marked ready." };
  }

  if (event.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Scorecards cannot be changed after scoring has started.",
    };
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      scorecardsReadyAt: now,
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  revalidatePaths(eventId, event.slug);
  return { success: true };
}

export async function undoScorecardsReady(
  eventId: string
): Promise<ActionResult> {
  const result = await requireWorkflowEvent(eventId);
  if (!result.ok) return { success: false, error: result.error };

  const { event } = result;

  if (!event.scorecardsReadyAt) {
    return { success: false, error: "Scorecards are not marked ready yet." };
  }

  if (event.scoringStatus !== "disabled") {
    return {
      success: false,
      error: "Cannot undo scorecards after scoring has started.",
    };
  }

  await getDb()
    .update(events)
    .set({
      scorecardsReadyAt: null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  revalidatePaths(eventId, event.slug);
  return { success: true };
}

/** Auto-close registration when sold out or past deadline. Idempotent. */
export async function syncRegistrationWorkflow(eventId: string): Promise<void> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (
    !event ||
    event.orgId !== org.id ||
    event.status !== "published" ||
    isRegistrationFinalized(event) ||
    event.scoringStatus !== "disabled"
  ) {
    return;
  }

  const registrationCount = await getRegistrationCount(eventId);

  const snapshot = buildEventWorkflowSnapshot({
    event,
    eventId,
    format: event.format,
    registrationCount,
    pairings: null,
  });

  if (snapshot.autoFinalizeReasons.length === 0) {
    return;
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      registrationFinalizedAt: now,
      registrationCloses: event.registrationCloses ?? now,
      status: "closed",
      updatedAt: now,
    })
    .where(eq(events.id, eventId));
}

function revalidatePaths(eventId: string, slug: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${slug}`);
  revalidatePath(`/print/events/${eventId}/scorecards`);
}
