import type { CourseTee } from "@/db/schema";

export type CourseTeeInput = {
  teeKey: string;
  teeName: string;
  teeColor?: string | null;
  sortOrder: number;
  courseRating?: string | null;
  slope?: number | null;
  totalYardage?: number | null;
};

export const DEFAULT_COURSE_TEES: CourseTeeInput[] = [
  { teeKey: "black", teeName: "Black", teeColor: "#1f2937", sortOrder: 0 },
  { teeKey: "blue", teeName: "Blue", teeColor: "#2563eb", sortOrder: 1 },
  { teeKey: "white", teeName: "White", teeColor: "#f8fafc", sortOrder: 2 },
];

export const PRESET_COURSE_TEES: CourseTeeInput[] = [
  { teeKey: "gold", teeName: "Gold", teeColor: "#ca8a04", sortOrder: 0 },
  { teeKey: "black", teeName: "Black", teeColor: "#1f2937", sortOrder: 1 },
  { teeKey: "blue", teeName: "Blue", teeColor: "#2563eb", sortOrder: 2 },
  { teeKey: "white", teeName: "White", teeColor: "#f8fafc", sortOrder: 3 },
  { teeKey: "red", teeName: "Red", teeColor: "#dc2626", sortOrder: 4 },
];

export function normalizeTeeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function teeMarkerColor(tee: Pick<CourseTee, "teeColor" | "teeKey">): string {
  if (tee.teeColor?.startsWith("#")) return tee.teeColor;
  return (
    PRESET_COURSE_TEES.find((entry) => entry.teeKey === tee.teeKey)?.teeColor ??
    "#2563eb"
  );
}

export function manualTeeOsmId(holeNumber: number, teeKey: string): string {
  return `manual:tee:${holeNumber}:${teeKey}`;
}

export function parseManualTeeOsmId(osmId: string | null | undefined): {
  holeNumber: number;
  teeKey: string;
} | null {
  if (!osmId) return null;

  const perTeeMatch = osmId.match(/^manual:tee:(\d+):([a-z0-9_]+)$/);
  if (perTeeMatch) {
    return {
      holeNumber: Number(perTeeMatch[1]),
      teeKey: perTeeMatch[2],
    };
  }

  const legacyMatch = osmId.match(/^manual:tee:(\d+)$/);
  if (legacyMatch) {
    return {
      holeNumber: Number(legacyMatch[1]),
      teeKey: "white",
    };
  }

  return null;
}

export function manualHoleLineOsmId(holeNumber: number, teeKey: string): string {
  return `manual:hole_line:${holeNumber}:${teeKey}`;
}

export function parseManualHoleLineOsmId(osmId: string | null | undefined): {
  holeNumber: number;
  teeKey: string;
} | null {
  if (!osmId) return null;

  const perTeeMatch = osmId.match(/^manual:hole_line:(\d+):([a-z0-9_]+)$/);
  if (perTeeMatch) {
    return {
      holeNumber: Number(perTeeMatch[1]),
      teeKey: perTeeMatch[2],
    };
  }

  const legacyMatch = osmId.match(/^manual:hole_line:(\d+)$/);
  if (legacyMatch) {
    return {
      holeNumber: Number(legacyMatch[1]),
      teeKey: "white",
    };
  }

  return null;
}

export function sortCourseTees<T extends Pick<CourseTee, "sortOrder" | "teeName">>(
  tees: T[]
): T[] {
  return [...tees].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.teeName.localeCompare(b.teeName);
  });
}

export function totalYardageForTee(
  teeKey: string,
  holes: { teeYardages?: Record<string, number> | null; yardage?: number | null }[]
): number | null {
  let total = 0;
  let hasValue = false;

  for (const hole of holes) {
    const yardage = hole.teeYardages?.[teeKey] ?? hole.yardage;
    if (yardage == null) continue;
    total += yardage;
    hasValue = true;
  }

  return hasValue ? total : null;
}
