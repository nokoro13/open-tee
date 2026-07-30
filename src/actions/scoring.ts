"use server";

import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events, holeScores, pairingGroups, registrations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { sendScoringLinkEmail } from "@/lib/email";
import { isOperationalEventStatus } from "@/lib/events";
import { isTeamHoleScoring } from "@/lib/event-formats";
import { validatePairingsForFormat } from "@/lib/event-workflow";
import { getEventPairings, type EventPairings } from "@/lib/pairings";
import { getGroupScorePageUrl } from "@/lib/scoring-code-storage";
import { getAppUrl } from "@/lib/stripe";
import { validatePriorHolesComplete } from "@/lib/score-entry-utils";
import {
  canEditScoringGroup,
  generateScoringCode,
  getGroupScoringProgress,
  getHoleCount,
  getHoleNumbers,
  getPublishedEventForScoring,
  getScoreEntryGroups,
  getScoresForEvent,
  isScoringEditable,
  resolveScoringAccess,
  scoresToMap,
} from "@/lib/scoring";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export type EmailPlayersScoringLinksResult =
  | {
      success: true;
      emailed: number;
      failed: number;
      skipped: number;
      warning?: string;
    }
  | { success: false; error: string };

type ScoringEmailRecipient = {
  email: string;
  name: string;
  scoreUrl: string;
  groupLabel?: string;
};

function collectScoringEmailRecipients(
  pairings: EventPairings,
  appUrl: string,
  slug: string
): { recipients: ScoringEmailRecipient[]; skipped: number } {
  const recipients: ScoringEmailRecipient[] = [];
  let skipped = 0;

  for (const group of pairings.groups) {
    const activePlayers = group.players.filter(
      (player) => player.paymentStatus !== "refunded"
    );

    if (!group.scoringCode) {
      skipped += activePlayers.length;
      continue;
    }

    const scoreUrl = getGroupScorePageUrl(appUrl, slug, group.scoringCode);

    for (const player of activePlayers) {
      recipients.push({
        email: player.email,
        name: player.name,
        scoreUrl,
        groupLabel: group.label,
      });
    }
  }

  for (const player of pairings.unassigned) {
    if (player.paymentStatus === "refunded") {
      skipped += 1;
      continue;
    }

    if (!player.scoringCode) {
      skipped += 1;
      continue;
    }

    recipients.push({
      email: player.email,
      name: player.name,
      scoreUrl: getGroupScorePageUrl(appUrl, slug, player.scoringCode),
    });
  }

  return { recipients, skipped };
}

async function resolvePlayerScoringRecipient(
  eventId: string,
  registrationId: string,
  appUrl: string,
  slug: string
): Promise<{ ok: true; recipient: ScoringEmailRecipient } | { ok: false; error: string }> {
  await syncRegistrationScoringCode(registrationId);
  await syncEventScoringCodes(eventId);

  const registration = await getDb().query.registrations.findFirst({
    where: and(
      eq(registrations.id, registrationId),
      eq(registrations.eventId, eventId)
    ),
    with: {
      pairingGroup: true,
    },
  });

  if (!registration) {
    return { ok: false, error: "Player not found." };
  }

  if (registration.paymentStatus === "refunded") {
    return { ok: false, error: "Refunded players cannot receive scoring emails." };
  }

  if (registration.pairingGroupId && registration.pairingGroup) {
    const group = registration.pairingGroup;

    if (!group.scoringCode) {
      return {
        ok: false,
        error: "No scoring link for this player's group yet.",
      };
    }

    return {
      ok: true,
      recipient: {
        email: registration.email,
        name: registration.name,
        scoreUrl: getGroupScorePageUrl(appUrl, slug, group.scoringCode),
        groupLabel: group.label,
      },
    };
  }

  if (!registration.scoringCode) {
    return { ok: false, error: "No scoring link for this player yet." };
  }

  return {
    ok: true,
    recipient: {
      email: registration.email,
      name: registration.name,
      scoreUrl: getGroupScorePageUrl(appUrl, slug, registration.scoringCode),
    },
  };
}

async function requirePublishedEvent(eventId: string) {
  await requireOrganization();
  const event = await getEventById(eventId);

  if (!event) {
    return { ok: false as const, error: "Event not found." };
  }

  if (!isOperationalEventStatus(event.status)) {
    return {
      ok: false as const,
      error: "Scoring is only available for live events.",
    };
  }

  return { ok: true as const, event };
}

async function isScoringCodeTaken(code: string): Promise<boolean> {
  const normalized = code.toUpperCase();

  const [event, groupMatch, registrationMatch] = await Promise.all([
    getDb().query.events.findFirst({
      where: eq(events.scoringCode, normalized),
      columns: { id: true },
    }),
    getDb().query.pairingGroups.findFirst({
      where: eq(pairingGroups.scoringCode, normalized),
      columns: { id: true },
    }),
    getDb().query.registrations.findFirst({
      where: eq(registrations.scoringCode, normalized),
      columns: { id: true },
    }),
  ]);

  if (event) return true;
  if (groupMatch) return true;
  if (registrationMatch) return true;

  return false;
}

async function createUniqueScoringCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateScoringCode(attempt >= 10 ? 8 : 6);
    if (!(await isScoringCodeTaken(code))) {
      return code;
    }
  }
  return generateScoringCode(8);
}

export async function syncEventScoringCodes(eventId: string): Promise<void> {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.scoringStatus === "finalized") return;

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
  });

  for (const group of groups) {
    if (!group.scoringCode) {
      await getDb()
        .update(pairingGroups)
        .set({
          scoringCode: await createUniqueScoringCode(),
          updatedAt: new Date(),
        })
        .where(eq(pairingGroups.id, group.id));
    }
  }

  const unassigned = await getDb().query.registrations.findMany({
    where: and(
      eq(registrations.eventId, eventId),
      isNull(registrations.pairingGroupId)
    ),
  });

  for (const player of unassigned) {
    if (player.paymentStatus === "refunded") continue;

    if (!player.scoringCode) {
      await getDb()
        .update(registrations)
        .set({
          scoringCode: await createUniqueScoringCode(),
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, player.id));
    }
  }
}

export async function ensurePairingGroupScoringCode(groupId: string): Promise<void> {
  const group = await getDb().query.pairingGroups.findFirst({
    where: eq(pairingGroups.id, groupId),
    with: { event: true },
  });

  if (!group || group.scoringCode || group.event.scoringStatus === "finalized") {
    return;
  }

  await getDb()
    .update(pairingGroups)
    .set({
      scoringCode: await createUniqueScoringCode(),
      updatedAt: new Date(),
    })
    .where(eq(pairingGroups.id, groupId));
}

export async function syncRegistrationScoringCode(
  registrationId: string
): Promise<void> {
  const registration = await getDb().query.registrations.findFirst({
    where: eq(registrations.id, registrationId),
    with: { event: true },
  });

  if (!registration || registration.event.scoringStatus === "finalized") {
    return;
  }

  if (registration.pairingGroupId) {
    if (registration.scoringCode) {
      await getDb()
        .update(registrations)
        .set({ scoringCode: null, updatedAt: new Date() })
        .where(eq(registrations.id, registrationId));
    }
    await ensurePairingGroupScoringCode(registration.pairingGroupId);
    return;
  }

  if (registration.paymentStatus === "refunded") {
    if (registration.scoringCode) {
      await getDb()
        .update(registrations)
        .set({ scoringCode: null, updatedAt: new Date() })
        .where(eq(registrations.id, registrationId));
    }
    return;
  }

  if (!registration.scoringCode) {
    await getDb()
      .update(registrations)
      .set({
        scoringCode: await createUniqueScoringCode(),
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, registrationId));
  }
}

export async function openScoring(eventId: string): Promise<ActionResult> {
  const result = await requirePublishedEvent(eventId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { event } = result;
  const org = await requireOrganization();

  if (event.scoringStatus === "finalized") {
    return { success: false, error: "Scoring is finalized and cannot be reopened." };
  }

  const pairings = await getEventPairings(eventId, org.id);
  if (!pairings) {
    return { success: false, error: "Could not load pairings." };
  }

  const pairingsIssues = validatePairingsForFormat(
    event.format,
    pairings,
    event.teamSize
  );
  if (pairingsIssues.length > 0) {
    return { success: false, error: pairingsIssues[0] };
  }

  const marshalCode = event.scoringCode ?? (await createUniqueScoringCode());
  const now = new Date();

  await getDb()
    .update(events)
    .set({
      scoringStatus: "open",
      scoringCode: marshalCode,
      registrationFinalizedAt: event.registrationFinalizedAt ?? now,
      status: event.status === "published" ? "closed" : event.status,
      pairingsFinalizedAt: event.pairingsFinalizedAt ?? now,
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  await syncEventScoringCodes(eventId);

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/score`);
  revalidatePath(`/e/${event.slug}/leaderboard`);
  return { success: true };
}

export async function emailPlayerScoringLink(
  eventId: string,
  registrationId: string
): Promise<ActionResult> {
  const result = await requirePublishedEvent(eventId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { event } = result;

  if (event.scoringStatus !== "open") {
    return {
      success: false,
      error: "Scoring must be open before emailing players.",
    };
  }

  const appUrl = getAppUrl();
  const recipientResult = await resolvePlayerScoringRecipient(
    eventId,
    registrationId,
    appUrl,
    event.slug
  );

  if (!recipientResult.ok) {
    return { success: false, error: recipientResult.error };
  }

  try {
    await sendScoringLinkEmail({
      to: recipientResult.recipient.email,
      playerName: recipientResult.recipient.name,
      eventName: event.name,
      eventDate: event.date,
      courseName: event.courseName,
      scoreUrl: recipientResult.recipient.scoreUrl,
      groupLabel: recipientResult.recipient.groupLabel,
      leaderboardUrl: `${appUrl}/e/${event.slug}/leaderboard`,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not send scoring email.",
    };
  }

  return { success: true };
}

export async function emailPlayersScoringLinks(
  eventId: string
): Promise<EmailPlayersScoringLinksResult> {
  const result = await requirePublishedEvent(eventId);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { event } = result;

  if (event.scoringStatus !== "open") {
    return {
      success: false,
      error: "Scoring must be open before emailing players.",
    };
  }

  const org = await requireOrganization();
  await syncEventScoringCodes(eventId);

  const pairings = await getEventPairings(eventId, org.id);
  if (!pairings) {
    return { success: false, error: "Event not found." };
  }

  const appUrl = getAppUrl();
  const leaderboardUrl = `${appUrl}/e/${event.slug}/leaderboard`;
  const { recipients, skipped } = collectScoringEmailRecipients(
    pairings,
    appUrl,
    event.slug
  );

  if (recipients.length === 0) {
    return {
      success: false,
      error:
        "No players with scoring links to email. Assign pairings and ensure players are registered.",
    };
  }

  let emailed = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const recipient of recipients) {
    try {
      await sendScoringLinkEmail({
        to: recipient.email,
        playerName: recipient.name,
        eventName: event.name,
        eventDate: event.date,
        courseName: event.courseName,
        scoreUrl: recipient.scoreUrl,
        groupLabel: recipient.groupLabel,
        leaderboardUrl,
      });
      emailed += 1;
    } catch (error) {
      failed += 1;
      if (!firstError) {
        firstError =
          error instanceof Error ? error.message : "Unknown email error.";
      }
    }
  }

  if (emailed === 0) {
    return {
      success: false,
      error:
        firstError ??
        "Could not send any emails. Check RESEND_API_KEY and EMAIL_FROM in your environment.",
    };
  }

  return {
    success: true,
    emailed,
    failed,
    skipped,
    ...(failed > 0 && firstError ? { warning: firstError } : {}),
  };
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

  const progress = await getGroupScoringProgress(
    eventId,
    event.format,
    event.holes
  );

  if (!progress.allComplete) {
    const remaining = progress.totalGroups - progress.completedGroups;
    return {
      success: false,
      error: `Cannot finalize yet — ${remaining} group${remaining === 1 ? "" : "s"} still need to finish scoring (${progress.completedGroups}/${progress.totalGroups} complete).`,
    };
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

  const access = await resolveScoringAccess(event.id, event, input.code);
  if (!access) {
    return { success: false, error: "Invalid scoring code." };
  }

  if (!canEditScoringGroup(access, input.groupId)) {
    return {
      success: false,
      error: "You can only enter scores for your assigned group.",
    };
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

  const scoreGroups = await getScoreEntryGroups(event.id, event.format);
  const targetGroup = scoreGroups.find((group) => group.id === input.groupId);
  if (!targetGroup) {
    return { success: false, error: "Group not found." };
  }

  const allowedRegistrationIds = new Set(
    targetGroup.players.map((player) => player.id)
  );

  const holeNumbers = getHoleNumbers(event.holes);
  const isTeamEntry = isTeamHoleScoring(input.format, input.matchType);
  const entryIds = isTeamEntry
    ? targetGroup.entrySides.map((side) => side.id)
    : targetGroup.players.map((player) => player.id);
  const existingScores = await getScoresForEvent(event.id);
  const scoreMap = scoresToMap(existingScores);
  const savedScores: Record<string, Record<number, number>> = {};

  for (const entryId of entryIds) {
    const holeMap = scoreMap.get(entryId);
    if (holeMap) {
      savedScores[entryId] = Object.fromEntries(holeMap);
    }
  }

  const priorHoleError = validatePriorHolesComplete(
    input.holeNumber,
    holeNumbers,
    entryIds,
    savedScores
  );
  if (priorHoleError) {
    return { success: false, error: priorHoleError };
  }

  const now = new Date();

  // The valid team sides for this group ("team" for a single-team group,
  // "a"/"b" when two teams share the group or for Ryder Cup foursomes).
  const allowedTeamSides = new Set(
    targetGroup.entrySides
      .map((side) => side.teamSide)
      .filter((side): side is "a" | "b" | "team" => side != null)
  );

  for (const score of input.scores) {
    if (score.strokes < 1 || score.strokes > 20) {
      return { success: false, error: "Scores must be between 1 and 20." };
    }

    if (isTeamEntry) {
      if (!score.pairingGroupId || score.pairingGroupId !== targetGroup.id) {
        return { success: false, error: "Invalid team score." };
      }

      const teamSide = score.teamSide ?? "team";
      if (!allowedTeamSides.has(teamSide)) {
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
    } else {
      if (!score.registrationId) {
        return { success: false, error: "Invalid player score." };
      }

      if (!allowedRegistrationIds.has(score.registrationId)) {
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

  if (isTeamEntry) {
    // Clean up stale rows for this hole in one pass: group-level scores on
    // sides that are no longer valid, plus any individual scores left over
    // from a format/team-size change. Doing this after all upserts avoids
    // sibling team sides deleting each other's fresh scores.
    const validSides = [...allowedTeamSides];
    await getDb()
      .delete(holeScores)
      .where(
        and(
          eq(holeScores.eventId, event.id),
          eq(holeScores.holeNumber, input.holeNumber),
          eq(holeScores.pairingGroupId, targetGroup.id),
          or(
            isNull(holeScores.teamSide),
            notInArray(holeScores.teamSide, validSides)
          )
        )
      );

    const groupPlayerIds = targetGroup.players.map((player) => player.id);
    if (groupPlayerIds.length > 0) {
      await getDb()
        .delete(holeScores)
        .where(
          and(
            eq(holeScores.eventId, event.id),
            eq(holeScores.holeNumber, input.holeNumber),
            inArray(holeScores.registrationId, groupPlayerIds)
          )
        );
    }
  }

  revalidatePath(`/e/${event.slug}/leaderboard`);
  revalidatePath(`/e/${event.slug}/score`);
  return { success: true };
}
