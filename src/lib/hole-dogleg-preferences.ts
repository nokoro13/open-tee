import type { LatLng } from "@/lib/green-distance";
import { yardsBetween } from "@/lib/green-distance";

const STORAGE_PREFIX = "openround-hole-dogleg";

export const MAX_DOGLEG_ANCHORS = 2;

export type HoleDoglegPreference =
  | { kind: "inherit" }
  | { kind: "none" }
  | { kind: "point"; lat: number; lng: number }
  | { kind: "points"; points: Array<{ lat: number; lng: number }> };

export type HoleDoglegPreferencesByHole = Record<number, HoleDoglegPreference>;

export function loadHoleDoglegPreferences(
  slug: string
): HoleDoglegPreferencesByHole {
  if (typeof window === "undefined") return {};

  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}:${slug}`);
    if (!raw) return {};
    return JSON.parse(raw) as HoleDoglegPreferencesByHole;
  } catch {
    return {};
  }
}

export function saveHoleDoglegPreferences(
  slug: string,
  preferences: HoleDoglegPreferencesByHole
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${STORAGE_PREFIX}:${slug}`, JSON.stringify(preferences));
}

export function normalizeHoleDoglegPreference(
  preference: HoleDoglegPreference | undefined
): HoleDoglegPreference | undefined {
  if (!preference) return undefined;
  if (preference.kind === "point") {
    return {
      kind: "points",
      points: [{ lat: preference.lat, lng: preference.lng }],
    };
  }
  return preference;
}

export function orderBreakPointsAlongPath(
  from: LatLng,
  to: LatLng,
  points: LatLng[]
): LatLng[] {
  return [...points]
    .sort(
      (left, right) => yardsBetween(from, left) - yardsBetween(from, right)
    )
    .slice(0, MAX_DOGLEG_ANCHORS);
}

export function resolveHoleDoglegBreaks(
  mappedBreaks: LatLng | LatLng[] | null,
  preference: HoleDoglegPreference | undefined
): LatLng[] {
  const mapped = normalizeMappedBreaks(mappedBreaks);
  const normalized = normalizeHoleDoglegPreference(preference);
  if (!normalized || normalized.kind === "inherit") {
    return mapped;
  }
  if (normalized.kind === "none") return [];
  if (normalized.kind === "point") {
    return [{ lat: normalized.lat, lng: normalized.lng }];
  }
  return normalized.points
    .slice(0, MAX_DOGLEG_ANCHORS)
    .map((point: { lat: number; lng: number }) => ({
      lat: point.lat,
      lng: point.lng,
    }));
}

export function resolveHoleDoglegBreak(
  mappedBreaks: LatLng | LatLng[] | null,
  preference: HoleDoglegPreference | undefined
): LatLng | null {
  return resolveHoleDoglegBreaks(mappedBreaks, preference)[0] ?? null;
}

function normalizeMappedBreaks(
  mappedBreaks: LatLng | LatLng[] | null
): LatLng[] {
  if (mappedBreaks == null) return [];
  return Array.isArray(mappedBreaks) ? mappedBreaks : [mappedBreaks];
}
