"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { LatLng } from "@/lib/green-distance";
import {
  loadHoleDoglegPreferences,
  MAX_DOGLEG_ANCHORS,
  orderBreakPointsAlongPath,
  resolveHoleDoglegBreak,
  resolveHoleDoglegBreaks,
  saveHoleDoglegPreferences,
  type HoleDoglegPreference,
  type HoleDoglegPreferencesByHole,
} from "@/lib/hole-dogleg-preferences";

type SlugStore = {
  preferences: HoleDoglegPreferencesByHole;
  listeners: Set<() => void>;
};

const stores = new Map<string, SlugStore>();

function getSlugStore(slug: string): SlugStore {
  let store = stores.get(slug);
  if (!store) {
    store = {
      preferences: loadHoleDoglegPreferences(slug),
      listeners: new Set(),
    };
    stores.set(slug, store);
  }
  return store;
}

function subscribeToSlug(slug: string, listener: () => void): () => void {
  const store = getSlugStore(slug);
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function getSlugPreferences(slug: string): HoleDoglegPreferencesByHole {
  return getSlugStore(slug).preferences;
}

function updateSlugPreferences(
  slug: string,
  updater: (
    current: HoleDoglegPreferencesByHole
  ) => HoleDoglegPreferencesByHole
): void {
  const store = getSlugStore(slug);
  store.preferences = updater(store.preferences);
  saveHoleDoglegPreferences(slug, store.preferences);
  store.listeners.forEach((listener) => listener());
}

export function useHoleDoglegPreferences(slug: string) {
  const preferences = useSyncExternalStore(
    (listener) => subscribeToSlug(slug, listener),
    () => getSlugPreferences(slug),
    () => loadHoleDoglegPreferences(slug)
  );

  const resolveBreaks = useCallback(
    (holeNumber: number, mappedBreaks: LatLng | LatLng[] | null) =>
      resolveHoleDoglegBreaks(mappedBreaks, preferences[holeNumber]),
    [preferences]
  );

  const resolveBreak = useCallback(
    (holeNumber: number, mappedBreaks: LatLng | LatLng[] | null) =>
      resolveHoleDoglegBreak(mappedBreaks, preferences[holeNumber]),
    [preferences]
  );

  const addBreakPoint = useCallback(
    (
      holeNumber: number,
      point: LatLng,
      mappedBreaks: LatLng | LatLng[] | null,
      from: LatLng,
      to: LatLng
    ) => {
      updateSlugPreferences(slug, (current) => {
        const existing = resolveHoleDoglegBreaks(
          mappedBreaks,
          current[holeNumber]
        );
        if (existing.length >= MAX_DOGLEG_ANCHORS) return current;

        const next = orderBreakPointsAlongPath(from, to, [...existing, point]);
        return {
          ...current,
          [holeNumber]: {
            kind: "points",
            points: next,
          },
        };
      });
    },
    [slug]
  );

  const updateBreakPoint = useCallback(
    (
      holeNumber: number,
      index: number,
      point: LatLng,
      mappedBreaks: LatLng | LatLng[] | null,
      from: LatLng,
      to: LatLng
    ) => {
      updateSlugPreferences(slug, (current) => {
        const existing = resolveHoleDoglegBreaks(
          mappedBreaks,
          current[holeNumber]
        );
        const updated = existing.map((currentPoint, currentIndex) =>
          currentIndex === index ? point : currentPoint
        );
        const next = orderBreakPointsAlongPath(from, to, updated);
        return {
          ...current,
          [holeNumber]: {
            kind: "points",
            points: next,
          },
        };
      });
    },
    [slug]
  );

  const removeBreakPoint = useCallback(
    (holeNumber: number, index: number, mappedBreaks: LatLng | LatLng[] | null) => {
      updateSlugPreferences(slug, (current) => {
        const existing = resolveHoleDoglegBreaks(
          mappedBreaks,
          current[holeNumber]
        );
        const next = existing.filter((_, currentIndex) => currentIndex !== index);
        return {
          ...current,
          [holeNumber]:
            next.length === 0
              ? { kind: "none" }
              : { kind: "points", points: next },
        };
      });
    },
    [slug]
  );

  const clearBreakPoints = useCallback(
    (holeNumber: number) => {
      updateSlugPreferences(slug, (current) => ({
        ...current,
        [holeNumber]: { kind: "none" },
      }));
    },
    [slug]
  );

  const getPreference = useCallback(
    (holeNumber: number): HoleDoglegPreference | undefined =>
      preferences[holeNumber],
    [preferences]
  );

  return {
    resolveBreak,
    resolveBreaks,
    addBreakPoint,
    updateBreakPoint,
    removeBreakPoint,
    clearBreakPoints,
    getPreference,
  };
}
