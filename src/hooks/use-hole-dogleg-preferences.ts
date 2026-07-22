"use client";

import { useCallback, useEffect, useState } from "react";

import type { LatLng } from "@/lib/green-distance";
import {
  loadHoleDoglegPreferences,
  resolveHoleDoglegBreak,
  saveHoleDoglegPreferences,
  type HoleDoglegPreference,
  type HoleDoglegPreferencesByHole,
} from "@/lib/hole-dogleg-preferences";

export function useHoleDoglegPreferences(slug: string) {
  const [preferences, setPreferences] = useState<HoleDoglegPreferencesByHole>(
    () => loadHoleDoglegPreferences(slug)
  );

  useEffect(() => {
    setPreferences(loadHoleDoglegPreferences(slug));
  }, [slug]);

  useEffect(() => {
    saveHoleDoglegPreferences(slug, preferences);
  }, [preferences, slug]);

  const resolveBreak = useCallback(
    (holeNumber: number, mappedBreak: LatLng | null) =>
      resolveHoleDoglegBreak(mappedBreak, preferences[holeNumber]),
    [preferences]
  );

  const setBreakPoint = useCallback((holeNumber: number, point: LatLng) => {
    setPreferences((current) => ({
      ...current,
      [holeNumber]: { kind: "point", lat: point.lat, lng: point.lng },
    }));
  }, []);

  const clearBreakPoint = useCallback((holeNumber: number) => {
    setPreferences((current) => ({
      ...current,
      [holeNumber]: { kind: "none" },
    }));
  }, []);

  const getPreference = useCallback(
    (holeNumber: number): HoleDoglegPreference | undefined =>
      preferences[holeNumber],
    [preferences]
  );

  return {
    resolveBreak,
    setBreakPoint,
    clearBreakPoint,
    getPreference,
  };
}
