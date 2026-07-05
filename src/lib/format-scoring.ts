import type { EventParMap } from "@/lib/scorecard";
import { strokesToPar } from "@/lib/scorecard";

export type HoleScores = Map<number, number>;

export type MatchResult = {
  holesUp: number;
  holesPlayed: number;
  holesRemaining: number;
  isComplete: boolean;
  winner: "a" | "b" | "tied" | null;
  pointsA: number;
  pointsB: number;
};

export function strokesToStablefordPoints(strokes: number, par: number): number {
  const diff = strokes - par;
  if (diff >= 2) return 0;
  if (diff === 1) return 1;
  if (diff === 0) return 2;
  if (diff === -1) return 3;
  if (diff === -2) return 4;
  return 5;
}

export function sumStablefordPoints(
  scores: HoleScores,
  parMap: EventParMap
): { points: number; thru: number } {
  let points = 0;
  let thru = 0;

  for (const [holeNumber, strokes] of scores) {
    const par = parMap.get(holeNumber);
    if (par == null) continue;
    points += strokesToStablefordPoints(strokes, par);
    thru += 1;
  }

  return { points, thru };
}

export function bestBallHoleScore(
  playerScores: HoleScores[],
  holeNumber: number
): number | null {
  let best: number | null = null;

  for (const scores of playerScores) {
    const strokes = scores.get(holeNumber);
    if (strokes == null) continue;
    if (best == null || strokes < best) best = strokes;
  }

  return best;
}

export function computeBestBallTotal(
  playerScores: HoleScores[],
  holeNumbers: number[]
): { total: number | null; thru: number; scoredHoles: number[] } {
  const scoredHoles: number[] = [];
  let total = 0;

  for (const holeNumber of holeNumbers) {
    const best = bestBallHoleScore(playerScores, holeNumber);
    if (best == null) continue;
    scoredHoles.push(holeNumber);
    total += best;
  }

  return {
    total: scoredHoles.length > 0 ? total : null,
    thru: scoredHoles.length,
    scoredHoles,
  };
}

export function compareHoleWinner(
  strokesA: number | undefined,
  strokesB: number | undefined
): "a" | "b" | "halved" | null {
  if (strokesA == null || strokesB == null) return null;
  if (strokesA < strokesB) return "a";
  if (strokesB < strokesA) return "b";
  return "halved";
}

export function computeSinglesMatch(
  scoresA: HoleScores,
  scoresB: HoleScores,
  holeNumbers: number[]
): MatchResult {
  let holesUp = 0;
  let holesPlayed = 0;

  for (const hole of holeNumbers) {
    const a = scoresA.get(hole);
    const b = scoresB.get(hole);
    const winner = compareHoleWinner(a, b);
    if (winner == null) continue;

    holesPlayed += 1;
    if (winner === "a") holesUp += 1;
    if (winner === "b") holesUp -= 1;
    if (winner === "halved") {
      // no change
    }
  }

  const holesRemaining = holeNumbers.length - holesPlayed;
  const absLead = Math.abs(holesUp);
  const isComplete =
    holesPlayed > 0 &&
    (absLead > holesRemaining ||
      holesPlayed === holeNumbers.length);

  let winner: MatchResult["winner"] = null;
  if (isComplete) {
    if (holesUp > 0) winner = "a";
    else if (holesUp < 0) winner = "b";
    else winner = "tied";
  }

  const pointsA =
    winner === "a" ? 1 : winner === "tied" ? 0.5 : winner === "b" ? 0 : 0;
  const pointsB =
    winner === "b" ? 1 : winner === "tied" ? 0.5 : winner === "a" ? 0 : 0;

  return {
    holesUp,
    holesPlayed,
    holesRemaining,
    isComplete,
    winner: isComplete ? winner : null,
    pointsA: isComplete ? pointsA : 0,
    pointsB: isComplete ? pointsB : 0,
  };
}

export function computeFourballMatch(
  teamAScores: HoleScores[],
  teamBScores: HoleScores[],
  holeNumbers: number[]
): MatchResult {
  const combinedA = new Map<number, number>();
  const combinedB = new Map<number, number>();

  for (const hole of holeNumbers) {
    const bestA = bestBallHoleScore(teamAScores, hole);
    const bestB = bestBallHoleScore(teamBScores, hole);
    if (bestA != null) combinedA.set(hole, bestA);
    if (bestB != null) combinedB.set(hole, bestB);
  }

  return computeSinglesMatch(combinedA, combinedB, holeNumbers);
}

export function computeFoursomesMatch(
  scoresA: HoleScores,
  scoresB: HoleScores,
  holeNumbers: number[]
): MatchResult {
  return computeSinglesMatch(scoresA, scoresB, holeNumbers);
}

export function formatMatchStatus(
  holesUp: number,
  holesPlayed: number,
  holeCount: number,
  isComplete: boolean
): string {
  if (holesPlayed === 0) return "—";

  if (isComplete) {
    if (holesUp === 0) return "Halved";
    const margin = Math.abs(holesUp);
    const remaining = holeCount - holesPlayed;
    if (remaining > 0 && margin > remaining) {
      return `${margin} & ${remaining}`;
    }
    return holesUp > 0 ? `${margin} up` : `${margin} down`;
  }

  if (holesUp === 0) return "All square";

  const margin = Math.abs(holesUp);
  const remaining = holeCount - holesPlayed;
  if (margin === remaining && remaining > 0) {
    return `${margin} up (dormie)`;
  }

  return holesUp > 0 ? `${margin} up` : `${margin} down`;
}

/** Match status from the leader's perspective (positive always means leader is up). */
export function formatLeaderMatchStatus(
  holesUp: number,
  leader: "a" | "b" | null,
  holesPlayed: number,
  holeCount: number,
  isComplete: boolean
): string {
  const fromLeader = leader === "b" ? -holesUp : holesUp;
  return formatMatchStatus(fromLeader, holesPlayed, holeCount, isComplete);
}

export function formatNamedMatchStatus(
  playerAName: string,
  playerBName: string,
  holesUp: number,
  holesPlayed: number,
  holeCount: number,
  isComplete: boolean
): string {
  if (holesPlayed === 0) return "Not started";

  if (isComplete) {
    if (holesUp === 0) return "Match halved";
    const margin = Math.abs(holesUp);
    const remaining = holeCount - holesPlayed;
    const winner = holesUp > 0 ? playerAName : playerBName;
    if (remaining > 0 && margin > remaining) {
      return `${winner} wins ${margin} & ${remaining}`;
    }
    return `${winner} wins ${margin} up`;
  }

  if (holesUp === 0) return "All square";

  const margin = Math.abs(holesUp);
  const remaining = holeCount - holesPlayed;
  const leader = holesUp > 0 ? playerAName : playerBName;

  if (margin === remaining && remaining > 0) {
    return `${leader} ${margin} up (dormie)`;
  }

  return `${leader} ${margin} up`;
}

export function formatRyderPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

export function enrichStrokeEntry(
  total: number | null,
  scoredHoles: number[],
  parMap: EventParMap
) {
  const toPar =
    total != null && scoredHoles.length > 0
      ? strokesToPar(total, parMap, scoredHoles)
      : null;

  return { toPar };
}
