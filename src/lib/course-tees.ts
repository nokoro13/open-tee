import type { CourseTee } from "@/db/schema";

type TeeColorLike = Pick<CourseTee, "teeKey" | "teeName"> & {
  teeColor?: string | null;
  combinationBaseTeeKeys?: string[] | null;
};

type CombinationTeeLike = Pick<CourseTee, "teeKey" | "teeName"> & {
  combinationBaseTeeKeys?: string[] | null;
};

export type { TeeColorLike };

const COMBINATION_TEE_NAME_SPLIT = /\s*(?:\/|&|\+|\band\b)\s*/i;
export const MAX_COMBINATION_BASE_TEES = 2;

export type CourseTeeInput = {
  teeKey: string;
  teeName: string;
  teeColor?: string | null;
  combinationBaseTeeKeys?: string[] | null;
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

export const TEE_COLOR_SWATCHES = [
  { name: "Black", color: "#1f2937" },
  { name: "Blue", color: "#2563eb" },
  { name: "White", color: "#f8fafc" },
  { name: "Green", color: "#16a34a" },
  { name: "Red", color: "#dc2626" },
  { name: "Gold", color: "#ca8a04" },
  { name: "Silver", color: "#94a3b8" },
  { name: "Brown", color: "#92400e" },
  { name: "Orange", color: "#ea580c" },
  { name: "Purple", color: "#7c3aed" },
] as const;

export function suggestTeeColor(
  teeName: string,
  teeKey: string,
  existingTees: Pick<CourseTeeInput, "teeColor" | "teeKey" | "teeName">[]
): string {
  const usedColors = new Set(
    existingTees
      .map((tee) => tee.teeColor?.trim().toLowerCase())
      .filter((color): color is string => Boolean(color))
  );

  const preset = PRESET_COURSE_TEES.find(
    (entry) =>
      normalizeTeeKey(entry.teeKey) === normalizeTeeKey(teeKey) ||
      normalizeTeeKey(entry.teeName) === normalizeTeeKey(teeName)
  );
  if (preset?.teeColor) return preset.teeColor;

  for (const swatch of TEE_COLOR_SWATCHES) {
    if (
      normalizeTeeKey(swatch.name) === normalizeTeeKey(teeName) ||
      normalizeTeeKey(swatch.name) === normalizeTeeKey(teeKey)
    ) {
      return swatch.color;
    }
  }

  for (const swatch of TEE_COLOR_SWATCHES) {
    if (!usedColors.has(swatch.color.toLowerCase())) {
      return swatch.color;
    }
  }

  return "#64748b";
}

export function resolveTeeDisplayColor(
  tee: TeeColorLike,
  allTees?: TeeColorLike[]
): string {
  if (tee.teeColor?.startsWith("#")) return tee.teeColor;
  if (allTees && isCombinationTee(tee, allTees)) {
    return "#64748b";
  }
  return teeMarkerColor({ teeKey: tee.teeKey, teeColor: tee.teeColor ?? null });
}

export type TeeCellStyle = {
  backgroundColor?: string;
  color?: string;
  background?: string;
  textShadow?: string;
};

export function getCombinationTeeColors(
  tee: Pick<CourseTee, "teeKey" | "teeName"> & {
    combinationBaseTeeKeys?: string[] | null;
  },
  allTees: TeeColorLike[]
): [string, string] | null {
  const baseKeys = getCombinationBaseTeeKeys(tee, allTees);
  if (!baseKeys || baseKeys.length < 2) return null;

  const colors = baseKeys.slice(0, 2).map((key) => {
    const baseTee = allTees.find((entry) => entry.teeKey === key);
    return baseTee ? resolveTeeDisplayColor(baseTee, allTees) : "#64748b";
  });

  return [colors[0]!, colors[1]!];
}

export function formatCombinationTeeName(
  baseTeeKeys: string[],
  allTees: Pick<CourseTee, "teeKey" | "teeName">[]
): string {
  return baseTeeKeys
    .map((key) => allTees.find((tee) => tee.teeKey === key)?.teeName ?? key)
    .join("/");
}

export function combinationTeeKeySignature(baseTeeKeys: string[]): string {
  return [...baseTeeKeys].sort().join("|");
}

export function hasStoredCombinationBaseTeeKeys(
  tee: Pick<CourseTee, "combinationBaseTeeKeys"> | TeeColorLike | CombinationTeeLike
): boolean {
  return (tee.combinationBaseTeeKeys?.length ?? 0) >= MAX_COMBINATION_BASE_TEES;
}

export function teeCellPresentation(fillColor: string): {
  className: string;
  style: TeeCellStyle;
} {
  return {
    className: "print:text-inherit",
    style: {
      backgroundColor: fillColor,
      color: teeMarkerLabelColor(fillColor),
    },
  };
}

export function yardageCellPresentationForHole(
  tee: TeeColorLike,
  allTees: TeeColorLike[],
  holeTeeYardages: Record<string, number | null | undefined>
): ReturnType<typeof teeCellPresentation> | null {
  if (isCombinationTee(tee, allTees)) {
    const fillColor = resolveCombinationTeeColorForHole(
      tee.teeKey,
      allTees,
      holeTeeYardages
    );
    return fillColor ? teeCellPresentation(fillColor) : null;
  }

  return teeCellPresentation(resolveTeeDisplayColor(tee, allTees));
}

export function resolveCombinationTeeColorForHole(
  comboTeeKey: string,
  allTees: TeeColorLike[],
  holeTeeYardages: Record<string, number | null | undefined>
): string | null {
  const comboTee = allTees.find((tee) => tee.teeKey === comboTeeKey);
  if (!comboTee) return null;

  const baseKeys = getCombinationBaseTeeKeys(comboTee, allTees);
  if (!baseKeys) return resolveTeeDisplayColor(comboTee, allTees);

  const comboYardage = holeTeeYardages[comboTeeKey];
  if (comboYardage == null) return null;

  const resolvedKey = resolveCombinationTeeKeyForHole(
    comboYardage,
    holeTeeYardages,
    baseKeys
  );
  if (!resolvedKey) return null;

  const baseTee = allTees.find((tee) => tee.teeKey === resolvedKey);
  return baseTee ? resolveTeeDisplayColor(baseTee, allTees) : null;
}

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

export function teeMarkerStrokeColor(fillColor: string): string {
  const normalized = fillColor.trim().toLowerCase();
  if (normalized === "#f8fafc" || normalized === "#ffffff" || normalized === "#fff") {
    return "#94a3b8";
  }
  return "#ffffff";
}

export function teeMarkerLabelColor(fillColor: string): string {
  const normalized = fillColor.trim().toLowerCase();
  if (normalized === "#f8fafc" || normalized === "#ffffff" || normalized === "#fff") {
    return "#111827";
  }
  return "#ffffff";
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

/** Longest (back) tees first — uses stored total or sums OUT/IN hole yardages. */
export function sortCourseTeesByTotalYardage<
  T extends Pick<CourseTee, "teeKey" | "teeName" | "sortOrder"> & {
    totalYardage?: number | null;
  },
>(
  tees: T[],
  holes: {
    teeYardages?: Record<string, number> | null;
    yardage?: number | null;
  }[]
): T[] {
  const totalForTee = (tee: T): number =>
    tee.totalYardage ?? totalYardageForTee(tee.teeKey, holes) ?? -1;

  return [...tees].sort((a, b) => {
    const yardageDiff = totalForTee(b) - totalForTee(a);
    if (yardageDiff !== 0) return yardageDiff;
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

export function parseCombinationTeeNameParts(teeName: string): string[] {
  const parts = teeName
    .split(COMBINATION_TEE_NAME_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : [];
}

export function resolveTeeKeyForNamePart(
  part: string,
  allTees: Pick<CourseTee, "teeKey" | "teeName">[]
): string | null {
  const normalizedPart = normalizeTeeKey(part);
  const byKey = allTees.find(
    (tee) => normalizeTeeKey(tee.teeKey) === normalizedPart
  );
  if (byKey) return byKey.teeKey;

  const byName = allTees.find(
    (tee) => normalizeTeeKey(tee.teeName) === normalizedPart
  );
  if (byName) return byName.teeKey;

  return null;
}

export function getCombinationBaseTeeKeys(
  tee: CombinationTeeLike,
  allTees: CombinationTeeLike[]
): string[] | null {
  const stored = validateStoredCombinationBaseTeeKeys(
    tee.combinationBaseTeeKeys,
    tee.teeKey,
    allTees
  );
  if (stored) return stored;

  return inferCombinationBaseTeeKeysFromName(tee, allTees);
}

function validateStoredCombinationBaseTeeKeys(
  baseTeeKeys: string[] | null | undefined,
  comboTeeKey: string,
  allTees: CombinationTeeLike[]
): string[] | null {
  if (!baseTeeKeys || baseTeeKeys.length < MAX_COMBINATION_BASE_TEES) {
    return null;
  }

  const keys: string[] = [];
  for (const key of baseTeeKeys.slice(0, MAX_COMBINATION_BASE_TEES)) {
    if (!key || key === comboTeeKey || keys.includes(key)) return null;

    const baseTee = allTees.find((entry) => entry.teeKey === key);
    if (!baseTee || hasStoredCombinationBaseTeeKeys(baseTee)) return null;

    keys.push(key);
  }

  return keys.length >= MAX_COMBINATION_BASE_TEES ? keys : null;
}

function inferCombinationBaseTeeKeysFromName(
  tee: Pick<CourseTee, "teeKey" | "teeName">,
  allTees: CombinationTeeLike[]
): string[] | null {
  const parts = parseCombinationTeeNameParts(tee.teeName);
  if (parts.length < 2) return null;

  const baseKeys: string[] = [];
  for (const part of parts) {
    const key = resolveTeeKeyForNamePart(part, allTees);
    if (!key || key === tee.teeKey) return null;

    const baseTee = allTees.find((entry) => entry.teeKey === key);
    if (baseTee && getCombinationBaseTeeKeys(baseTee, allTees)) return null;
    if (!baseKeys.includes(key)) baseKeys.push(key);
  }

  return baseKeys.length >= MAX_COMBINATION_BASE_TEES ? baseKeys : null;
}

export function isCombinationTee(
  tee: CombinationTeeLike,
  allTees: CombinationTeeLike[]
): boolean {
  if (hasStoredCombinationBaseTeeKeys(tee)) {
    return (
      validateStoredCombinationBaseTeeKeys(
        tee.combinationBaseTeeKeys,
        tee.teeKey,
        allTees
      ) != null
    );
  }

  return inferCombinationBaseTeeKeysFromName(tee, allTees) != null;
}

export function teesRequiringMapPins<
  T extends Pick<CourseTee, "teeKey" | "teeName"> &
    Partial<Pick<CourseTee, "sortOrder">>,
>(allTees: T[]): T[] {
  const baseTees = allTees.filter((tee) => !isCombinationTee(tee, allTees));
  return [...baseTees].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.teeName.localeCompare(b.teeName);
  });
}

export function resolveCombinationTeeKeyForHole(
  comboYardage: number,
  holeTeeYardages: Record<string, number | null | undefined>,
  baseTeeKeys: string[]
): string | null {
  const matches = baseTeeKeys.filter((key) => holeTeeYardages[key] === comboYardage);
  return matches.length === 1 ? matches[0]! : matches[0] ?? null;
}

export function resolveEffectiveTeeKeyForHole(
  selectedTeeKey: string,
  allTees: Pick<CourseTee, "teeKey" | "teeName">[],
  holeTeeYardages: Record<string, number | null | undefined>,
  comboYardage?: number | null
): string {
  const tee = allTees.find((entry) => entry.teeKey === selectedTeeKey);
  if (!tee) return selectedTeeKey;

  const baseKeys = getCombinationBaseTeeKeys(tee, allTees);
  if (!baseKeys) return selectedTeeKey;

  const yardage = comboYardage ?? holeTeeYardages[selectedTeeKey];
  if (yardage == null) return baseKeys[0]!;

  return (
    resolveCombinationTeeKeyForHole(yardage, holeTeeYardages, baseKeys) ??
    baseKeys[0]!
  );
}

export function countPlacedMappingTees(
  placedTeeKeys: string[],
  allTees: Pick<CourseTee, "teeKey" | "teeName">[]
): number {
  const requiredKeys = new Set(
    teesRequiringMapPins(allTees).map((tee) => tee.teeKey)
  );
  return placedTeeKeys.filter((key) => requiredKeys.has(key)).length;
}

export function isHoleMappingCompleteForTees(
  hasGreen: boolean,
  placedTeeKeys: string[],
  allTees: Pick<CourseTee, "teeKey" | "teeName">[]
): boolean {
  const requiredTees = teesRequiringMapPins(allTees);
  return (
    hasGreen &&
    countPlacedMappingTees(placedTeeKeys, allTees) >= requiredTees.length
  );
}
