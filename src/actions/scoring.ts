"use server";

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events, holeScores, registrations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { isTeamHoleScoring } from "@/lib/event-formats";
import {
  generateScoringCode,
  getHoleCount,
  getPublishedEventForScoring,
  isScoringEditable,
  validateScoringCode,
} from "@/lib/scoring";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

async function requirePublishedEvent(eventId: string) {
  await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { ok: false as const, error: "Event not found." };
  }

  if (event.status !== "published") {
    return {
      ok: false as const,
      error: "Scoring is only available for published events.",
    };
  }

  return { ok: true as const, event };
}

async function ensureUniqueScoringCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateScoringCode();
    const existing = await getDb().query.events.findFirst({
      where: eq(events.scoringCode, code),
    });
    if (!existing) return code;
  }
  return generateScoringCode(8);
}

export async function openScoring(eventId: string): Promise<ActionResult> {
  const result = await requirePublishedEvent(eventId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { event } = result;

  if (event.scoringStatus === "finalized") {
    return { success: false, error: "Scoring is finalized and cannot be reopened." };
  }

  const code = event.scoringCode ?? (await ensureUniqueScoringCode());

  await getDb()
    .update(events)
    .set({
      scoringStatus: "open",
      scoringCode: code,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}/score`);
  revalidatePath(`/e/${event.slug}/leaderboard`);
  return { success: true };
}

export async function finalizeScoring(eventId: string): Promise<ActionResult> {
  const result = await requirePublishedEvent(eventId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { event } = result;

  if (event.scoringStatus !== "open") {
    return { success: false, error: "Scoring must be open before finalizing." };
  }

  const now = new Date();

  await getDb()
    .update(events)
    .set({
      scoringStatus: "finalized",
      scoringFinalizedAt: now,
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}/score`);
  revalidatePath(`/e/${event.slug}/leaderboard`);
  return { success: true };
}

export type SaveHoleScoresInput = {
  slug: string;
  code: string;
  holeNumber: number;
  format: string;
  matchType?: string | null;
  groupId: string;
  scores: {
    registrationId?: string;
    pairingGroupId?: string;
    teamSide?: "a" | "b" | "team";
    strokes: number;
  }[];
};

export async function saveHoleScores(
  input: SaveHoleScoresInput
): Promise<ActionResult> {
  const event = await getPublishedEventForScoring(input.slug);

  if (!event) {
    return { success: false, error: "Event not found." };
  }

  if (!validateScoringCode(event, input.code)) {
    return { success: false, error: "Invalid scoring code." };
  }

  if (!isScoringEditable(event.scoringStatus)) {
    return { success: false, error: "Scoring is not open for this event." };
  }

  const maxHole = getHoleCount(event.holes);
  if (input.holeNumber < 1 || input.holeNumber > maxHole) {
    return { success: false, error: "Invalid hole number." };
  }

  if (input.scores.length === 0) {
    return { success: false, error: "No scores provided." };
  }

  const now = new Date();

  for (const score of input.scores) {
    if (score.strokes < 1 || score.strokes > 20) {
      return { success: false, error: "Scores must be between 1 and 20." };
    }

    if (isTeamHoleScoring(input.format, input.matchType)) {
      if (!score.pairingGroupId) {
        return { success: false, error: "Invalid team score." };
      }

      const teamSide =
        input.format === "ryder_cup" && input.matchType === "foursomes"
          ? score.teamSide === "a" || score.teamSide === "b"
            ? score.teamSide
            : null
          : "team";

      if (!teamSide) {
        return { success: false, error: "Invalid team side." };
      }

      const existing = await getDb().query.holeScores.findFirst({
        where: and(
          eq(holeScores.eventId, event.id),
          eq(holeScores.holeNumber, input.holeNumber),
          eq(holeScores.pairingGroupId, score.pairingGroupId),
          eq(holeScores.teamSide, teamSide)
        ),
      });

      if (existing) {
        await getDb()
          .update(holeScores)
          .set({ strokes: score.strokes, updatedAt: now })
          .where(eq(holeScores.id, existing.id));
      } else {
        await getDb().insert(holeScores).values({
          eventId: event.id,
          holeNumber: input.holeNumber,
          pairingGroupId: score.pairingGroupId,
          teamSide,
          strokes: score.strokes,
        });
      }

      // Remove legacy duplicate rows for the same group/hole (e.g. null teamSide).
      await getDb()
        .delete(holeScores)
        .where(
          and(
            eq(holeScores.eventId, event.id),
            eq(holeScores.holeNumber, input.holeNumber),
            eq(holeScores.pairingGroupId, score.pairingGroupId),
            or(isNull(holeScores.teamSide), ne(holeScores.teamSide, teamSide))
          )
        );

      const groupPlayers = await getDb().query.registrations.findMany({
        where: eq(registrations.pairingGroupId, score.pairingGroupId),
        columns: { id: true },
      });

      for (const player of groupPlayers) {
        await getDb()
          .delete(holeScores)
          .where(
            and(
              eq(holeScores.eventId, event.id),
              eq(holeScores.holeNumber, input.holeNumber),
              eq(holeScores.registrationId, player.id)
            )
          );
      }
    } else {
      if (!score.registrationId) {
        return { success: false, error: "Invalid player score." };
      }

      const existing = await getDb().query.holeScores.findFirst({
        where: and(
          eq(holeScores.eventId, event.id),
          eq(holeScores.holeNumber, input.holeNumber),
          eq(holeScores.registrationId, score.registrationId)
        ),
      });

      if (existing) {
        await getDb()
          .update(holeScores)
          .set({ strokes: score.strokes, updatedAt: now })
          .where(eq(holeScores.id, existing.id));
      } else {
        await getDb().insert(holeScores).values({
          eventId: event.id,
          holeNumber: input.holeNumber,
          registrationId: score.registrationId,
          strokes: score.strokes,
        });
      }
    }
  }

  revalidatePath(`/e/${event.slug}/leaderboard`);
  revalidatePath(`/e/${event.slug}/score`);
  return { success: true };
}
