import type { LatLng } from "@/lib/green-distance";

const STORAGE_PREFIX = "openround-hole-dogleg";

export type HoleDoglegPreference =
  | { kind: "inherit" }
  | { kind: "none" }
  | { kind: "point"; lat: number; lng: number };

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

export function resolveHoleDoglegBreak(
  mappedBreak: LatLng | null,
  preference: HoleDoglegPreference | undefined
): LatLng | null {
  if (!preference || preference.kind === "inherit") return mappedBreak;
  if (preference.kind === "none") return null;
  return { lat: preference.lat, lng: preference.lng };
}
