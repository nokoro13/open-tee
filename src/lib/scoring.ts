import { and, eq, inArray, isNull } from "drizzle-orm";

import { getEventParMap, formatScoreToPar, getEventScorecard } from "@/lib/scorecard";
import { attachLeaderboardScorecards, type LeaderboardScorecard } from "@/lib/leaderboard-scorecard";
import { dedupeScoresByHole, sumDedupedStrokes } from "@/lib/score-aggregation";
import {
  parseCourseHandicap,
  strokesReceivedOnHole,
} from "@/lib/handicap-strokes";
import {
  computeBestBallTotal,
  computeFourballMatch,
  computeFoursomesMatch,
  computeSinglesMatch,
  enrichStrokeEntry,
  formatLeaderMatchStatus,
  formatMatchStatus,
  formatRyderPoints,
  sumStablefordPoints,
  type HoleScores,
} from "@/lib/format-scoring";
import {
  DEFAULT_TEAM_A_NAME,
  DEFAULT_TEAM_B_NAME,
  getLeaderboardMode,
  getPairSideLabel,
  getSortDirection,
  isTeamHoleScoring,
  type TeamSide,
} from "@/lib/event-formats";
import { isRoundComplete } from "@/lib/score-entry-utils";
import { getDb } from "@/db";
import { events, holeScores, pairingGroups, registrations } from "@/db/schema";

const SCORING_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type LeaderboardEntry = {
  id: string;
  rank: number;
  name: string;
  subtitle?: string;
  thru: number;
  total: number | null;
  totalDisplay: string | null;
  toPar: number | null;
  toParDisplay: string | null;
  isComplete: boolean;
  matchPlayers?: {
    playerAName: string;
    playerBName: string;
    leader: "a" | "b" | null;
  };
  scorecard?: LeaderboardScorecard | null;
};

export type RyderCupSummary = {
  teamAName: string;
  teamBName: string;
  teamAPoints: number;
  teamBPoints: number;
};

export type LeaderboardOptions = {
  scoreBasis?: "gross" | "net";
  flightId?: string | null;
};

export type LeaderboardResult = {
  entries: LeaderboardEntry[];
  ryderCup?: RyderCupSummary;
};

export type ScoreEntrySide = {
  id: string;
  label: string;
  teamSide?: TeamSide | "team";
};

export type ScoreEntryGroup = {
  id: string;
  label: string;
  teeTime: string | null;
  matchType?: string | null;
  players: { id: string; name: string; teamSide?: TeamSide | "team" | null }[];
  isTeam: boolean;
  entrySides: ScoreEntrySide[];
};

export type GroupScoringProgress = {
  totalGroups: number;
  completedGroups: number;
  allComplete: boolean;
};

export function generateScoringCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += SCORING_CODE_CHARS[Math.floor(Math.random() * SCORING_CODE_CHARS.length)];
  }
  return code;
}

export function getHoleCount(holes: "9" | "18"): number {
  return holes === "9" ? 9 : 18;
}

export function getHoleNumbers(holes: "9" | "18"): number[] {
  const count = getHoleCount(holes);
  return Array.from({ length: count }, (_, i) => i + 1);
}

export function isScoringEditable(
  scoringStatus: "disabled" | "open" | "finalized"
): boolean {
  return scoringStatus === "open";
}

export function validateScoringCode(
  event: { scoringCode: string | null; scoringStatus: string },
  code: string | undefined
): boolean {
  if (!code || !event.scoringCode) return false;
  if (event.scoringStatus === "disabled") return false;
  return event.scoringCode.toUpperCase() === code.toUpperCase();
}

export type ScoringAccess =
  | { type: "marshal" }
  | { type: "group"; groupId: string };

export async function resolveScoringAccess(
  eventId: string,
  event: { scoringCode: string | null; scoringStatus: string },
  code: string | undefined
): Promise<ScoringAccess | null> {
  if (!code?.trim() || event.scoringStatus === "disabled") return null;

  const normalized = code.trim().toUpperCase();

  if (event.scoringCode && event.scoringCode.toUpperCase() === normalized) {
    return { type: "marshal" };
  }

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    columns: { id: true, scoringCode: true },
  });

  const matchedGroup = groups.find(
    (group) => group.scoringCode?.toUpperCase() === normalized
  );
  if (matchedGroup) {
    return { type: "group", groupId: matchedGroup.id };
  }

  const unassigned = await getDb().query.registrations.findMany({
    where: and(
      eq(registrations.eventId, eventId),
      isNull(registrations.pairingGroupId)
    ),
    columns: { id: true, scoringCode: true, paymentStatus: true },
  });

  const matchedPlayer = unassigned.find(
    (player) =>
      player.paymentStatus !== "refunded" &&
      player.scoringCode?.toUpperCase() === normalized
  );
  if (matchedPlayer) {
    return { type: "group", groupId: matchedPlayer.id };
  }

  return null;
}

export function canEditScoringGroup(
  access: ScoringAccess,
  groupId: string
): boolean {
  if (access.type === "marshal") return true;
  return access.groupId === groupId;
}

export function assignRanks(
  entries: Omit<LeaderboardEntry, "rank">[],
  sortDirection: "asc" | "desc" = "asc"
): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const aTotal = a.total ?? (sortDirection === "asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
    const bTotal = b.total ?? (sortDirection === "asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
    if (aTotal !== bTotal) {
      return sortDirection === "asc" ? aTotal - bTotal : bTotal - aTotal;
    }
    return a.name.localeCompare(b.name);
  });

  let rank = 0;
  let previousTotal: number | null = null;
  let tiedCount = 0;

  return sorted.map((entry) => {
    const total = entry.total;
    if (total === null) {
      return { ...entry, rank: 0 };
    }

    if (previousTotal === null || total !== previousTotal) {
      rank += tiedCount + 1;
      tiedCount = 0;
      previousTotal = total;
    } else {
      tiedCount += 1;
    }

    return { ...entry, rank };
  });
}

export async function getScoresForEvent(eventId: string) {
  return getDb().query.holeScores.findMany({
    where: eq(holeScores.eventId, eventId),
  });
}

function playerScoreMap(
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  registrationId: string
): HoleScores {
  const map: HoleScores = new Map();
  const playerRows = scores.filter((score) => score.registrationId === registrationId);
  for (const score of dedupeScoresByHole(playerRows)) {
    map.set(score.holeNumber, score.strokes);
  }
  return map;
}

function teamScoreMap(
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  pairingGroupId: string,
  teamSide: "a" | "b" | "team" = "team"
): HoleScores {
  const map: HoleScores = new Map();
  const teamRows = scores.filter((score) => {
    if (score.pairingGroupId !== pairingGroupId) return false;
    const side = score.teamSide ?? "team";
    return side === teamSide;
  });
  for (const score of dedupeScoresByHole(teamRows)) {
    map.set(score.holeNumber, score.strokes);
  }
  return map;
}

function strokeEntry(
  base: Omit<LeaderboardEntry, "rank" | "toPar" | "toParDisplay" | "totalDisplay">,
  scoredHoles: number[],
  parMap: Map<number, number>
): Omit<LeaderboardEntry, "rank"> {
  const { toPar } = enrichStrokeEntry(base.total, scoredHoles, parMap);
  return {
    ...base,
    totalDisplay: base.total == null ? null : String(base.total),
    toPar,
    toParDisplay: toPar == null ? null : formatScoreToPar(toPar),
  };
}

async function buildIndividualStrokeLeaderboard(
  eventId: string,
  holes: "9" | "18",
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const holeCount = getHoleCount(holes);
  const holeNumbers = getHoleNumbers(holes);
  const scores = await getScoresForEvent(eventId);
  const parMap = await getEventParMap(eventId);
  const eventHoles = await getEventScorecard(eventId);
  const strokeIndexByHole = new Map(
    eventHoles.map((hole) => [hole.holeNumber, hole.strokeIndex ?? hole.holeNumber])
  );

  const activePlayers = await getDb().query.registrations.findMany({
    where: eq(registrations.eventId, eventId),
  });

  const entries = activePlayers
    .filter((player) => player.paymentStatus !== "refunded")
    .filter((player) =>
      options.flightId ? player.flightId === options.flightId : true
    )
    .map((player) => {
      const playerScores = scores.filter((s) => s.registrationId === player.id);
      const { total: grossTotal, thru, scoredHoles } = sumDedupedStrokes(playerScores);

      let total = grossTotal;
      if (options.scoreBasis === "net" && grossTotal != null) {
        const courseHandicap = parseCourseHandicap(player.handicap);
        if (courseHandicap != null && courseHandicap > 0) {
          let netTotal = 0;
          for (const score of playerScores) {
            const strokeIndex =
              strokeIndexByHole.get(score.holeNumber) ?? score.holeNumber;
            const received = strokesReceivedOnHole(
              courseHandicap,
              strokeIndex,
              holeCount
            );
            netTotal += score.strokes - received;
          }
          total = netTotal;
        }
      }

      return strokeEntry(
        {
          id: player.id,
          name: player.name,
          thru,
          total,
          isComplete: thru === holeCount && scoredHoles.length === holeCount,
        },
        scoredHoles,
        parMap
      );
    });

  return assignRanks(entries, "asc");
}

async function buildTeamStrokeLeaderboard(
  eventId: string,
  holes: "9" | "18"
): Promise<LeaderboardEntry[]> {
  const holeCount = getHoleCount(holes);
  const scores = await getScoresForEvent(eventId);
  const parMap = await getEventParMap(eventId);

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    with: { registrations: true },
    orderBy: (pairingGroups, { asc }) => [asc(pairingGroups.sortOrder)],
  });

  const entries = groups
    .filter((group) => group.registrations.length > 0)
    .map((group) => {
      const groupScores = scores.filter(
        (s) => s.pairingGroupId === group.id && (s.teamSide ?? "team") === "team"
      );
      const { total, thru, scoredHoles } = sumDedupedStrokes(groupScores);

      return strokeEntry(
        {
          id: group.id,
          name: group.label,
          subtitle: group.registrations.map((r) => r.name).join(", "),
          thru,
          total,
          isComplete: thru === holeCount && scoredHoles.length === holeCount,
        },
        scoredHoles,
        parMap
      );
    });

  return assignRanks(entries, "asc");
}

async function buildTeamBestBallLeaderboard(
  eventId: string,
  format: string,
  holes: "9" | "18",
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const holeCount = getHoleCount(holes);
  const holeNumbers = getHoleNumbers(holes);
  const scores = await getScoresForEvent(eventId);
  const parMap = await getEventParMap(eventId);
  const eventHoles = await getEventScorecard(eventId);
  const strokeIndexByHole = new Map(
    eventHoles.map((hole) => [hole.holeNumber, hole.strokeIndex ?? hole.holeNumber])
  );
  const usePairs = format === "best_ball";

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    with: { registrations: true },
    orderBy: (pairingGroups, { asc }) => [asc(pairingGroups.sortOrder)],
  });

  const entries: Omit<LeaderboardEntry, "rank">[] = [];

  for (const group of groups) {
    if (group.registrations.length === 0) continue;
    if (options.flightId && group.flightId !== options.flightId) continue;

    const teamUnits = usePairs
      ? (["a", "b"] as const)
          .map((side) => ({
            id: `${group.id}:${side}`,
            label: `${group.label} · ${getPairSideLabel(side)}`,
            players: group.registrations.filter(
              (player) => player.teamSide === side
            ),
          }))
          .filter((team) => team.players.length > 0)
      : [
          {
            id: group.id,
            label: group.label,
            players: group.registrations,
          },
        ];

    for (const team of teamUnits) {
      const playerMaps = team.players.map((player) =>
        playerScoreMap(scores, player.id)
      );

      let total: number | null;
      let thru: number;
      let scoredHoles: number[];

      if (options.scoreBasis === "net") {
        const netScoresByHole: number[] = [];
        for (const holeNumber of holeNumbers) {
          let bestNet: number | null = null;
          for (let i = 0; i < team.players.length; i++) {
            const player = team.players[i];
            const gross = playerMaps[i]?.get(holeNumber);
            if (gross == null) continue;
            const courseHandicap = parseCourseHandicap(player.handicap);
            const strokeIndex =
              strokeIndexByHole.get(holeNumber) ?? holeNumber;
            const received =
              courseHandicap != null && courseHandicap > 0
                ? strokesReceivedOnHole(courseHandicap, strokeIndex, holeCount)
                : 0;
            const net = gross - received;
            if (bestNet == null || net < bestNet) bestNet = net;
          }
          if (bestNet != null) netScoresByHole.push(bestNet);
        }
        total =
          netScoresByHole.length > 0
            ? netScoresByHole.reduce((a, b) => a + b, 0)
            : null;
        thru = netScoresByHole.length;
        scoredHoles = netScoresByHole.map((_, index) => holeNumbers[index]);
      } else {
        const computed = computeBestBallTotal(playerMaps, holeNumbers);
        total = computed.total;
        thru = computed.thru;
        scoredHoles = computed.scoredHoles;
      }

      entries.push(
        strokeEntry(
          {
            id: team.id,
            name: team.label,
            subtitle: team.players.map((player) => player.name).join(", "),
            thru,
            total,
            isComplete: thru === holeCount && scoredHoles.length === holeCount,
          },
          scoredHoles,
          parMap
        )
      );
    }
  }

  return assignRanks(entries, "asc");
}

async function buildStablefordLeaderboard(
  eventId: string,
  holes: "9" | "18"
): Promise<LeaderboardEntry[]> {
  const holeCount = getHoleCount(holes);
  const scores = await getScoresForEvent(eventId);
  const parMap = await getEventParMap(eventId);

  const activePlayers = await getDb().query.registrations.findMany({
    where: eq(registrations.eventId, eventId),
  });

  const entries = activePlayers
    .filter((player) => player.paymentStatus !== "refunded")
    .map((player) => {
      const map = playerScoreMap(scores, player.id);
      const { points, thru } = sumStablefordPoints(map, parMap);

      return {
        id: player.id,
        name: player.name,
        thru,
        total: thru > 0 ? points : null,
        totalDisplay: thru > 0 ? String(points) : null,
        toPar: null,
        toParDisplay: null,
        isComplete: thru === holeCount,
      };
    });

  return assignRanks(entries, "desc");
}

async function buildMatchLeaderboard(
  eventId: string,
  holes: "9" | "18"
): Promise<LeaderboardEntry[]> {
  const holeCount = getHoleCount(holes);
  const holeNumbers = getHoleNumbers(holes);
  const scores = await getScoresForEvent(eventId);

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    with: { registrations: true },
    orderBy: (pairingGroups, { asc }) => [asc(pairingGroups.sortOrder)],
  });

  const entries = groups
    .filter((group) => group.registrations.length >= 2)
    .map((group) => {
      const [playerA, playerB] = group.registrations;
      const scoresA = playerScoreMap(scores, playerA.id);
      const scoresB = playerScoreMap(scores, playerB.id);
      const result = computeSinglesMatch(scoresA, scoresB, holeNumbers);

      const leader: "a" | "b" | null =
        result.holesPlayed === 0
          ? null
          : result.holesUp > 0
            ? "a"
            : result.holesUp < 0
              ? "b"
              : null;

      const status = formatLeaderMatchStatus(
        result.holesUp,
        leader,
        result.holesPlayed,
        holeCount,
        result.isComplete
      );

      return {
        id: group.id,
        name: `${playerA.name} vs ${playerB.name}`,
        subtitle: group.label,
        thru: result.holesPlayed,
        total: result.holesPlayed > 0 ? result.holesUp : null,
        totalDisplay: status,
        toPar: null,
        toParDisplay: null,
        isComplete: result.isComplete,
        matchPlayers: {
          playerAName: playerA.name,
          playerBName: playerB.name,
          leader,
        },
      };
    });

  return assignRanks(entries, "desc");
}

async function buildRyderCupLeaderboard(
  eventId: string,
  holes: "9" | "18"
): Promise<LeaderboardResult> {
  const holeCount = getHoleCount(holes);
  const holeNumbers = getHoleNumbers(holes);
  const scores = await getScoresForEvent(eventId);

  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  const teamAName = event?.teamAName?.trim() || DEFAULT_TEAM_A_NAME;
  const teamBName = event?.teamBName?.trim() || DEFAULT_TEAM_B_NAME;

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    with: { registrations: true },
    orderBy: (pairingGroups, { asc }) => [asc(pairingGroups.sortOrder)],
  });

  let teamAPoints = 0;
  let teamBPoints = 0;

  const entries = groups
    .filter((group) => group.registrations.length >= 2 && group.matchType)
    .map((group) => {
      const teamAPlayers = group.registrations.filter((r) => r.teamSide === "a");
      const teamBPlayers = group.registrations.filter((r) => r.teamSide === "b");

      let result;
      let subtitle = `${teamAName} vs ${teamBName}`;

      if (group.matchType === "foursomes") {
        const scoresA = teamScoreMap(scores, group.id, "a");
        const scoresB = teamScoreMap(scores, group.id, "b");
        result = computeFoursomesMatch(scoresA, scoresB, holeNumbers);
        subtitle = `Foursomes · ${teamAPlayers.map((p) => p.name).join(" & ")} vs ${teamBPlayers.map((p) => p.name).join(" & ")}`;
      } else if (group.matchType === "fourball") {
        result = computeFourballMatch(
          teamAPlayers.map((p) => playerScoreMap(scores, p.id)),
          teamBPlayers.map((p) => playerScoreMap(scores, p.id)),
          holeNumbers
        );
        subtitle = `Fourball · ${teamAPlayers.map((p) => p.name).join(" & ")} vs ${teamBPlayers.map((p) => p.name).join(" & ")}`;
      } else {
        const playerA = teamAPlayers[0];
        const playerB = teamBPlayers[0];
        if (!playerA || !playerB) {
          return null;
        }
        result = computeSinglesMatch(
          playerScoreMap(scores, playerA.id),
          playerScoreMap(scores, playerB.id),
          holeNumbers
        );
        subtitle = `Singles · ${playerA.name} vs ${playerB.name}`;
      }

      if (result.isComplete) {
        teamAPoints += result.pointsA;
        teamBPoints += result.pointsB;
      }

      const status = formatMatchStatus(
        result.holesUp,
        result.holesPlayed,
        holeCount,
        result.isComplete
      );

      const pointsLabel =
        result.isComplete && result.winner
          ? result.winner === "tied"
            ? "½ pt each"
            : result.winner === "a"
              ? `${teamAName} +1`
              : `${teamBName} +1`
          : null;

      return {
        id: group.id,
        name: group.label,
        subtitle: pointsLabel ? `${subtitle} · ${pointsLabel}` : subtitle,
        thru: result.holesPlayed,
        total: result.holesPlayed > 0 ? result.holesUp : null,
        totalDisplay: status,
        toPar: null,
        toParDisplay: null,
        isComplete: result.isComplete,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return {
    entries: assignRanks(entries, "desc"),
    ryderCup: {
      teamAName,
      teamBName,
      teamAPoints,
      teamBPoints,
    },
  };
}

export async function buildLeaderboard(
  eventId: string,
  format: string,
  holes: "9" | "18",
  options: LeaderboardOptions = {}
): Promise<LeaderboardResult> {
  const mode = getLeaderboardMode(format);

  let result: LeaderboardResult;

  switch (mode) {
    case "team_stroke":
      result = { entries: await buildTeamStrokeLeaderboard(eventId, holes) };
      break;
    case "team_best_ball":
      result = {
        entries: await buildTeamBestBallLeaderboard(eventId, format, holes, options),
      };
      break;
    case "stableford":
      result = { entries: await buildStablefordLeaderboard(eventId, holes) };
      break;
    case "match":
      result = { entries: await buildMatchLeaderboard(eventId, holes) };
      break;
    case "ryder_cup":
      result = await buildRyderCupLeaderboard(eventId, holes);
      break;
    case "individual_stroke":
    default:
      result = {
        entries: await buildIndividualStrokeLeaderboard(eventId, holes, options),
      };
      break;
  }

  const eventHoles = await getEventScorecard(eventId);
  result.entries = await attachLeaderboardScorecards(
    result.entries,
    eventId,
    format,
    holes,
    eventHoles.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: hole.strokeIndex ?? null,
    }))
  );

  return result;
}

function buildEntrySides(
  format: string,
  group: {
    id: string;
    label: string;
    matchType: string | null;
    registrations: { id: string; name: string; teamSide: "a" | "b" | "team" | null }[];
  },
  teamAName: string,
  teamBName: string
): ScoreEntrySide[] {
  if (format === "ryder_cup" && group.matchType === "foursomes") {
    return [
      { id: `${group.id}:a`, label: teamAName, teamSide: "a" },
      { id: `${group.id}:b`, label: teamBName, teamSide: "b" },
    ];
  }

  if (isTeamHoleScoring(format, group.matchType)) {
    return [{ id: group.id, label: group.label, teamSide: "team" }];
  }

  return group.registrations.map((player) => ({
    id: player.id,
    label: player.name,
  }));
}

export async function getScoreEntryGroups(
  eventId: string,
  format: string
): Promise<ScoreEntryGroup[]> {
  const event = await getDb().query.events.findFirst({
    where: eq(events.id, eventId),
  });

  const teamAName = event?.teamAName?.trim() || DEFAULT_TEAM_A_NAME;
  const teamBName = event?.teamBName?.trim() || DEFAULT_TEAM_B_NAME;

  const groups = await getDb().query.pairingGroups.findMany({
    where: eq(pairingGroups.eventId, eventId),
    with: { registrations: true },
    orderBy: (pairingGroups, { asc }) => [asc(pairingGroups.sortOrder)],
  });

  const assignedIds = new Set<string>();
  const result: ScoreEntryGroup[] = [];

  for (const group of groups) {
    if (group.registrations.length === 0) continue;
    group.registrations.forEach((r) => assignedIds.add(r.id));

    const isTeam = isTeamHoleScoring(format, group.matchType);
    result.push({
      id: group.id,
      label: group.label,
      teeTime: group.teeTime,
      matchType: group.matchType,
      players: group.registrations.map((r) => ({
        id: r.id,
        name: r.name,
        teamSide: r.teamSide,
      })),
      isTeam,
      entrySides: buildEntrySides(format, group, teamAName, teamBName),
    });
  }

  if (format !== "ryder_cup") {
    const unassigned = await getDb().query.registrations.findMany({
      where: eq(registrations.eventId, eventId),
    });

    for (const player of unassigned) {
      if (player.paymentStatus === "refunded" || assignedIds.has(player.id)) {
        continue;
      }
      result.push({
        id: player.id,
        label: player.name,
        teeTime: null,
        matchType: null,
        players: [{ id: player.id, name: player.name, teamSide: player.teamSide }],
        isTeam: false,
        entrySides: [{ id: player.id, label: player.name }],
      });
    }
  }

  return result;
}

function scoresMapToRecord(
  scoresMap: Map<string, Map<number, number>>
): Record<string, Record<number, number>> {
  const record: Record<string, Record<number, number>> = {};
  for (const [key, holeMap] of scoresMap) {
    record[key] = Object.fromEntries(holeMap);
  }
  return record;
}

function isScoringGroupComplete(
  group: ScoreEntryGroup,
  format: string,
  holeNumbers: number[],
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  scoresRecord: Record<string, Record<number, number>>
): boolean {
  if (format === "match_play") {
    if (group.players.length < 2) return false;
    const [playerA, playerB] = group.players;
    const result = computeSinglesMatch(
      playerScoreMap(scores, playerA.id),
      playerScoreMap(scores, playerB.id),
      holeNumbers
    );
    return result.isComplete;
  }

  if (format === "ryder_cup") {
    const teamAPlayers = group.players.filter((player) => player.teamSide === "a");
    const teamBPlayers = group.players.filter((player) => player.teamSide === "b");

    if (group.matchType === "foursomes") {
      const result = computeFoursomesMatch(
        teamScoreMap(scores, group.id, "a"),
        teamScoreMap(scores, group.id, "b"),
        holeNumbers
      );
      return result.isComplete;
    }

    if (group.matchType === "fourball") {
      const result = computeFourballMatch(
        teamAPlayers.map((player) => playerScoreMap(scores, player.id)),
        teamBPlayers.map((player) => playerScoreMap(scores, player.id)),
        holeNumbers
      );
      return result.isComplete;
    }

    const playerA = teamAPlayers[0];
    const playerB = teamBPlayers[0];
    if (!playerA || !playerB) return false;

    const result = computeSinglesMatch(
      playerScoreMap(scores, playerA.id),
      playerScoreMap(scores, playerB.id),
      holeNumbers
    );
    return result.isComplete;
  }

  const entryIds = group.entrySides.map((side) => side.id);
  return isRoundComplete(holeNumbers, entryIds, scoresRecord);
}

export async function getGroupScoringProgress(
  eventId: string,
  format: string,
  holes: "9" | "18"
): Promise<GroupScoringProgress> {
  const holeNumbers = getHoleNumbers(holes);
  const scoreEntryGroups = await getScoreEntryGroups(eventId, format);

  if (scoreEntryGroups.length === 0) {
    return { totalGroups: 0, completedGroups: 0, allComplete: false };
  }

  const scores = await getScoresForEvent(eventId);
  const scoresMap = scoresToMap(
    scores,
    format,
    scoreEntryGroups.map((group) => ({
      id: group.id,
      matchType: group.matchType ?? null,
    }))
  );
  const scoresRecord = scoresMapToRecord(scoresMap);

  let completedGroups = 0;
  for (const group of scoreEntryGroups) {
    if (
      isScoringGroupComplete(group, format, holeNumbers, scores, scoresRecord)
    ) {
      completedGroups += 1;
    }
  }

  return {
    totalGroups: scoreEntryGroups.length,
    completedGroups,
    allComplete: completedGroups === scoreEntryGroups.length,
  };
}

export async function getPublishedEventForScoring(slug: string) {
  return getDb().query.events.findFirst({
    where: and(
      eq(events.slug, slug),
      inArray(events.status, ["published", "closed"])
    ),
    with: {
      organization: true,
      eventHoles: {
        orderBy: (eventHoles, { asc }) => [asc(eventHoles.holeNumber)],
      },
    },
  });
}

export function scoresToMap(
  scores: Awaited<ReturnType<typeof getScoresForEvent>>,
  format: string,
  groups?: { id: string; matchType: string | null }[]
) {
  const buckets = new Map<string, Awaited<ReturnType<typeof getScoresForEvent>>>();
  const groupMatchTypes = new Map(groups?.map((g) => [g.id, g.matchType]));

  for (const score of scores) {
    let key: string | null = null;

    if (score.registrationId) {
      key = score.registrationId;
    } else if (score.pairingGroupId) {
      const matchType = groupMatchTypes?.get(score.pairingGroupId);
      if (format === "ryder_cup" && matchType === "foursomes") {
        const side = score.teamSide ?? "team";
        key = `${score.pairingGroupId}:${side}`;
      } else {
        key = score.pairingGroupId;
      }
    }

    if (!key) continue;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(score);
  }

  const map = new Map<string, Map<number, number>>();
  for (const [key, rows] of buckets) {
    const holeMap = new Map<number, number>();
    for (const row of dedupeScoresByHole(rows)) {
      holeMap.set(row.holeNumber, row.strokes);
    }
    map.set(key, holeMap);
  }

  return map;
}

export async function buildEventScoresRecord(
  eventId: string,
  format: string
): Promise<Record<string, Record<number, number>>> {
  const [scores, allGroups] = await Promise.all([
    getScoresForEvent(eventId),
    getScoreEntryGroups(eventId, format),
  ]);

  const scoreMap = scoresToMap(
    scores,
    format,
    allGroups.map((group) => ({ id: group.id, matchType: group.matchType ?? null }))
  );

  const record: Record<string, Record<number, number>> = {};
  for (const [key, holes] of scoreMap.entries()) {
    record[key] = Object.fromEntries(holes.entries());
  }

  return record;
}

export function formatRyderCupScore(
  teamAPoints: number,
  teamBPoints: number
): string {
  return `${formatRyderPoints(teamAPoints)} – ${formatRyderPoints(teamBPoints)}`;
}
