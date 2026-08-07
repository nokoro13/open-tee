"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { LatLng } from "@/lib/green-distance";
import {
  loadHoleDoglegPreferences,
  resolveHoleDoglegBreak,
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

  const resolveBreak = useCallback(
    (holeNumber: number, mappedBreak: LatLng | null) =>
      resolveHoleDoglegBreak(mappedBreak, preferences[holeNumber]),
    [preferences]
  );

  const setBreakPoint = useCallback(
    (holeNumber: number, point: LatLng) => {
      updateSlugPreferences(slug, (current) => ({
        ...current,
        [holeNumber]: { kind: "point", lat: point.lat, lng: point.lng },
      }));
    },
    [slug]
  );

  const clearBreakPoint = useCallback(
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
    setBreakPoint,
    clearBreakPoint,
    getPreference,
  };
}
