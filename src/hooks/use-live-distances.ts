"use client";

import {
  liveDistancesFromPosition,
  MIN_LIVE_DISTANCE_YARDS,
  type GreenTargets,
  type GreenTargetsByEventHole,
  type LiveDistances,
} from "@/lib/green-distance";
import { useGeolocation } from "@/hooks/use-geolocation";

export type LiveDistanceStatus =
  | "hidden"
  | "prompt"
  | "locating"
  | "live"
  | "at-green"
  | "unavailable"
  | "denied";

export function useLiveDistances(
  activeHole: number,
  targetsByHole: GreenTargetsByEventHole | undefined,
  enabled = true
) {
  const { position, status: geoStatus, requestLocation } =
    useGeolocation(enabled);

  const targets: GreenTargets | null = targetsByHole?.[activeHole] ?? null;
  const distances: LiveDistances = liveDistancesFromPosition(position, targets);

  let status: LiveDistanceStatus = "hidden";
  if (!enabled || !targetsByHole) {
    status = "hidden";
  } else if (geoStatus === "idle") {
    status = "prompt";
  } else if (geoStatus === "denied") {
    status = "denied";
  } else if (geoStatus === "unavailable") {
    status = "unavailable";
  } else if (
    distances.middle != null &&
    distances.middle <= MIN_LIVE_DISTANCE_YARDS
  ) {
    status = "at-green";
  } else if (position && distances.middle != null) {
    status = "live";
  } else {
    status = "locating";
  }

  return {
    position,
    distances,
    status,
    targets,
    requestLocation,
  };
}
