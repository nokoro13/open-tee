import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { events, pairingGroups, registrations } from "@/db/schema";
import { getLeaderboardMode } from "@/lib/event-formats";
import {
  strokesToStablefordPoints,
  type HoleScores,
} from "@/lib/format-scoring";
import {
  formatHandicapDisplay,
  parseCourseHandicap,
  strokesReceivedOnHole,
} from "@/lib/handicap-strokes";
import { dedupeScoresByHole } from "@/lib/score-aggregation";
import {
  getHoleCount,
  getHoleNumbers,
  getScoresForEvent,
  type LeaderboardEntry,
} from "@/lib/scoring";

export type LeaderboardScorecardHole = {
  holeNumber: number;
  par: number;
  strokeIndex: number | null;
};

export type LeaderboardScorecardPlayerRow = {
  id: string;
  name: string;
  handicapDisplay: string | null;
  grossScores: (number | null)[];
  strokesReceived: number[];
  grossTotal: number | null;
};

export type LeaderboardScorecardSummaryRow = {
  label: string;
  scores: (number | null)[];
  total: number | null;
  variant: "team" | "net" | "points";
};

export type LeaderboardScorecard = {
  holes: LeaderboardScorecardHole[];
  playerRows: LeaderboardScorecardPlayerRow[];
  summaryRow?: LeaderboardScorecardSummaryRow;
};

function buildHoleData(
  eventHoles: {
    holeNumber: number;
    par: number;
    strokeIndex: number | null;
  }[],
  holes: "9" | "18"
): LeaderboardScorecardHole[] {
  const holeCount = getHoleCount(holes);

  if (eventHoles.length > 0) {
    return eventHoles.slice(0, holeCount).map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
    }));
  }

  return Array.from({ length: holeCount }, (_, index) => ({
    holeNumber: index + 1,
    par: 4,
    strokeIndex: index + 1,
  }));
}

function buildStrokesReceived(
  courseHandicap: number | null,
  holeData: LeaderboardScorecardHole[]
): number[] {
  const holeCount = holeData.length;
  if (courseHandicap == null || courseHandicap <= 0) {
    return Array.from({ length: holeCount }, () => 0);
  }

  return holeData.map((hole) =>
    strokesReceivedOnHole(
      courseHandicap,
      hole.strokeIndex ?? hole.holeNumber,
      holeCount
    )
  );
}

function scoresArrayFromMap(
  scoreMap: HoleScores,
  holeNumbers: number[]
): (number | null)[] {
  return holeNumbers.map((holeNumber) => scoreMap.get(holeNumber) ?? null);
}

function sumScores(scores: (number | null)[]): number | null {
  let total = 0;
  let count = 0;
  for (const score of scores) {
    if (score == null) continue;
    total += score;
    count += 1;
  }
  return count > 0 ? total : null;
}

function playerScoreMapFromRows(
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  registrationId: string
): HoleScores {
  const map: HoleScores = new Map();
  const playerRows = scores.filter(
    (score) => score.registrationId === registrationId
  );
  for (const score of dedupeScoresByHole(playerRows)) {
    map.set(score.holeNumber, score.strokes);
  }
  return map;
}

function teamScoreMapFromRows(
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  pairingGroupId: string,
  teamSide: "a" | "b" | "team" = "team"
): HoleScores {
  const map: HoleScores = new Map();
  const teamRows = scores.filter((score) => {
    if (score.pairingGroupId !== pairingGroupId) return false;
    return (score.teamSide ?? "team") === teamSide;
  });
  for (const score of dedupeScoresByHole(teamRows)) {
    map.set(score.holeNumber, score.strokes);
  }
  return map;
}

function buildPlayerRow(
  player: { id: string; name: string; handicap: string | null },
  scoreMap: HoleScores,
  holeNumbers: number[],
  holeData: LeaderboardScorecardHole[]
): LeaderboardScorecardPlayerRow {
  const courseHandicap = parseCourseHandicap(player.handicap);
  const grossScores = scoresArrayFromMap(scoreMap, holeNumbers);

  return {
    id: player.id,
    name: player.name,
    handicapDisplay: player.handicap
      ? formatHandicapDisplay(player.handicap)
      : null,
    grossScores,
    strokesReceived: buildStrokesReceived(courseHandicap, holeData),
    grossTotal: sumScores(grossScores),
  };
}

function buildBestBallNetRow(
  playerRows: LeaderboardScorecardPlayerRow[],
  holeNumbers: number[]
): LeaderboardScorecardSummaryRow {
  const scores = holeNumbers.map((_, index) => {
    let best: number | null = null;

    for (const player of playerRows) {
      const gross = player.grossScores[index];
      if (gross == null) continue;
      const net = gross - (player.strokesReceived[index] ?? 0);
      if (best == null || net < best) best = net;
    }

    return best;
  });

  return {
    label: "Net",
    scores,
    total: sumScores(scores),
    variant: "net",
  };
}

function buildTeamSummaryRow(
  label: string,
  scoreMap: HoleScores,
  holeNumbers: number[]
): LeaderboardScorecardSummaryRow {
  const scores = scoresArrayFromMap(scoreMap, holeNumbers);
  return {
    label,
    scores,
    total: sumScores(scores),
    variant: "team",
  };
}

function buildStablefordSummaryRow(
  playerRow: LeaderboardScorecardPlayerRow,
  holeData: LeaderboardScorecardHole[]
): LeaderboardScorecardSummaryRow {
  const scores = playerRow.grossScores.map((strokes, index) => {
    if (strokes == null) return null;
    const par = holeData[index]?.par;
    if (par == null) return null;
    return strokesToStablefordPoints(strokes, par);
  });

  return {
    label: "Points",
    scores,
    total: sumScores(scores),
    variant: "points",
  };
}

function teamRowLabel(format: string): string {
  switch (format) {
    case "best_ball":
      return "Gross best ball";
    case "scramble":
    case "alternate_shot":
    case "shamble":
      return "Team score";
    default:
      return "Team score";
  }
}

type EntryContext = {
  players: { id: string; name: string; handicap: string | null }[];
  groupId: string | null;
  matchType: string | null;
};

async function loadEntryContexts(eventId: string, format: string) {
  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    with: { registrations: true },
  });

  const soloPlayers = await getDb().query.registrations.findMany({
    where: eq(registrations.eventId, eventId),
  });

  const contexts = new Map<string, EntryContext>();
  const usePairs = format === "best_ball";

  for (const group of groups) {
    const active = group.registrations.filter(
      (player) => player.paymentStatus !== "refunded"
    );
    if (active.length === 0) continue;

    if (usePairs) {
      for (const side of ["a", "b"] as const) {
        const teamPlayers = active.filter((player) => player.teamSide === side);
        if (teamPlayers.length === 0) continue;

        contexts.set(`${group.id}:${side}`, {
          groupId: group.id,
          matchType: group.matchType,
          players: teamPlayers.map((player) => ({
            id: player.id,
            name: player.name,
            handicap: player.handicap,
          })),
        });
      }
      continue;
    }

    contexts.set(group.id, {
      groupId: group.id,
      matchType: group.matchType,
      players: active.map((player) => ({
        id: player.id,
        name: player.name,
        handicap: player.handicap,
      })),
    });
  }

  for (const player of soloPlayers) {
    if (player.paymentStatus === "refunded") continue;
    if (contexts.has(player.id)) continue;

    const inGroup = groups.some((group) =>
      group.registrations.some((registration) => registration.id === player.id)
    );
    if (inGroup) continue;

    contexts.set(player.id, {
      groupId: null,
      matchType: null,
      players: [
        {
          id: player.id,
          name: player.name,
          handicap: player.handicap,
        },
      ],
    });
  }

  return contexts;
}

function resolveEntryContext(
  entryId: string,
  contexts: Map<string, EntryContext>
): EntryContext | undefined {
  const direct = contexts.get(entryId);
  if (direct) return direct;

  for (const context of contexts.values()) {
    const player = context.players.find((entry) => entry.id === entryId);
    if (player) {
      return {
        groupId: context.groupId,
        matchType: context.matchType,
        players: [player],
      };
    }
  }

  return undefined;
}

function buildScorecardForEntry(
  format: string,
  holes: "9" | "18",
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  holeData: LeaderboardScorecardHole[],
  context: EntryContext | undefined,
  teamNames?: { teamA: string; teamB: string }
): LeaderboardScorecard | null {
  if (!context || context.players.length === 0) return null;

  const holeNumbers = getHoleNumbers(holes);
  const mode = getLeaderboardMode(format);

  if (mode === "team_stroke" && context.groupId) {
    const teamScores = teamScoreMapFromRows(scores, context.groupId, "team");
    return {
      holes: holeData,
      playerRows: [],
      summaryRow: buildTeamSummaryRow(
        teamRowLabel(format),
        teamScores,
        holeNumbers
      ),
    };
  }

  const playerRows = context.players.map((player) =>
    buildPlayerRow(
      player,
      playerScoreMapFromRows(scores, player.id),
      holeNumbers,
      holeData
    )
  );

  if (mode === "team_best_ball") {
    return {
      holes: holeData,
      playerRows,
      summaryRow: buildBestBallNetRow(playerRows, holeNumbers),
    };
  }

  if (mode === "match" || mode === "ryder_cup") {
    if (mode === "ryder_cup" && context.matchType === "foursomes" && context.groupId) {
      const teamA = teamScoreMapFromRows(scores, context.groupId, "a");
      const teamB = teamScoreMapFromRows(scores, context.groupId, "b");
      return {
        holes: holeData,
        playerRows: [
          buildPlayerRow(
            {
              id: `${context.groupId}:a`,
              name: teamNames?.teamA ?? "Team A",
              handicap: null,
            },
            teamA,
            holeNumbers,
            holeData
          ),
          buildPlayerRow(
            {
              id: `${context.groupId}:b`,
              name: teamNames?.teamB ?? "Team B",
              handicap: null,
            },
            teamB,
            holeNumbers,
            holeData
          ),
        ],
      };
    }

    return {
      holes: holeData,
      playerRows,
    };
  }

  if (mode === "stableford" && playerRows[0]) {
    return {
      holes: holeData,
      playerRows,
      summaryRow: buildStablefordSummaryRow(playerRows[0], holeData),
    };
  }

  let summaryRow: LeaderboardScorecardSummaryRow | undefined;

  if (
    mode === "individual_stroke" &&
    playerRows.length === 1 &&
    playerRows[0]?.handicapDisplay
  ) {
    const player = playerRows[0];
    const netScores = player.grossScores.map((gross, index) => {
      if (gross == null) return null;
      return gross - (player.strokesReceived[index] ?? 0);
    });
    summaryRow = {
      label: "Net",
      scores: netScores,
      total: sumScores(netScores),
      variant: "net",
    };
  }

  return {
    holes: holeData,
    playerRows,
    summaryRow,
  };
}

export async function attachLeaderboardScorecards(
  entries: LeaderboardEntry[],
  eventId: string,
  format: string,
  holes: "9" | "18",
  eventHoles: {
    holeNumber: number;
    par: number;
    strokeIndex: number | null;
  }[]
): Promise<LeaderboardEntry[]> {
  if (entries.length === 0) return entries;

  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { teamAName: true, teamBName: true },
  });

  const scores = await getScoresForEvent(eventId);
  const holeData = buildHoleData(eventHoles, holes);
  const contexts = await loadEntryContexts(eventId, format);

  return entries.map((entry) => ({
    ...entry,
    scorecard: buildScorecardForEntry(
      format,
      holes,
      scores,
      holeData,
      resolveEntryContext(entry.id, contexts),
      event
        ? {
            teamA: event.teamAName?.trim() || "Team A",
            teamB: event.teamBName?.trim() || "Team B",
          }
        : undefined
    ),
  }));
}
