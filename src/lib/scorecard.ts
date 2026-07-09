import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { eventHoles } from "@/db/schema";
import type { OpenGolfCourseDetail, OpenGolfScorecardHole } from "@/lib/opengolfapi";

export type ScorecardHoleSnapshot = {
  holeNumber: number;
  par: number;
  yardage?: number | null;
  strokeIndex?: number | null;
  yardagesByTee?: Record<string, number | null>;
};

export type EventParMap = Map<number, number>;

export function formatScoreToPar(toPar: number): string {
  if (toPar === 0) return "E";
  if (toPar > 0) return `+${toPar}`;
  return String(toPar);
}

export function formatHoleScoreLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === 0) return `${strokes} (E)`;
  if (diff > 0) return `${strokes} (+${diff})`;
  return `${strokes} (${diff})`;
}

export type ScoreParMark =
  | "par"
  | "birdie"
  | "eagle"
  | "bogey"
  | "double-bogey-or-worse";

export function getScoreParMark(
  strokes: number,
  par: number
): ScoreParMark {
  const diff = strokes - par;
  if (diff === 0) return "par";
  if (diff === -1) return "birdie";
  if (diff <= -2) return "eagle";
  if (diff === 1) return "bogey";
  return "double-bogey-or-worse";
}

export function buildScorecardSnapshot(
  scorecard: OpenGolfScorecardHole[],
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  }
): ScorecardHoleSnapshot[] {
  const sorted = [...scorecard].sort((a, b) => a.hole - b.hole);

  if (options.holes === "18") {
    return sorted.slice(0, 18).map((hole, index) => ({
      holeNumber: index + 1,
      par: hole.par,
      yardage: hole.yardage ?? null,
      strokeIndex: hole.handicap_index ?? null,
    }));
  }

  const side = options.nineSide ?? "front";
  const slice =
    side === "back" && sorted.length >= 18
      ? sorted.slice(9, 18)
      : sorted.slice(0, 9);

  return slice.map((hole, index) => ({
    holeNumber: index + 1,
    par: hole.par,
    yardage: hole.yardage ?? null,
    strokeIndex: hole.handicap_index ?? null,
  }));
}

export function buildSnapshotFromCourse(
  course: OpenGolfCourseDetail,
  options: {
    holes: "9" | "18";
    nineSide?: "front" | "back" | null;
  }
): ScorecardHoleSnapshot[] | null {
  if (!course.scorecard?.length) return null;
  return buildScorecardSnapshot(course.scorecard, options);
}

export function totalPar(holes: ScorecardHoleSnapshot[]): number {
  return holes.reduce((sum, hole) => sum + hole.par, 0);
}

export async function getEventParMap(eventId: string): Promise<EventParMap> {
  const holes = await getDb().query.eventHoles.findMany({
    where: eq(eventHoles.eventId, eventId),
    orderBy: [asc(eventHoles.holeNumber)],
  });

  return new Map(holes.map((hole) => [hole.holeNumber, hole.par]));
}

export async function getEventScorecard(
  eventId: string
): Promise<ScorecardHoleSnapshot[]> {
  const holes = await getDb().query.eventHoles.findMany({
    where: eq(eventHoles.eventId, eventId),
    orderBy: [asc(eventHoles.holeNumber)],
  });

  return holes.map((hole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    yardage: hole.yardage,
    strokeIndex: hole.strokeIndex,
  }));
}

export function parThru(
  parMap: EventParMap,
  scoredHoleNumbers: number[]
): number {
  return scoredHoleNumbers.reduce(
    (sum, holeNumber) => sum + (parMap.get(holeNumber) ?? 0),
    0
  );
}

export function strokesToPar(
  totalStrokes: number,
  parMap: EventParMap,
  scoredHoleNumbers: number[]
): number {
  return totalStrokes - parThru(parMap, scoredHoleNumbers);
}

export async function replaceEventScorecard(
  eventId: string,
  holes: ScorecardHoleSnapshot[]
) {
  await getDb().delete(eventHoles).where(eq(eventHoles.eventId, eventId));

  if (holes.length === 0) return;

  await getDb()
    .insert(eventHoles)
    .values(
      holes.map((hole) => ({
        eventId,
        holeNumber: hole.holeNumber,
        par: hole.par,
        yardage: hole.yardage ?? null,
        strokeIndex: hole.strokeIndex ?? null,
      }))
    );
}
