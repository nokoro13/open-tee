export type LatLng = {
  lat: number;
  lng: number;
};

export type GreenTargets = {
  front: LatLng;
  middle: LatLng;
  back: LatLng;
};

export type GreenTargetsByEventHole = Record<number, GreenTargets | null>;

export const MIN_LIVE_DISTANCE_YARDS = 30;

export function eventHoleToCourseHole(
  eventHole: number,
  event: { holes: "9" | "18"; nineSide?: "front" | "back" | null }
): number {
  if (event.holes === "18") return eventHole;
  return (event.nineSide ?? "front") === "back" ? eventHole + 9 : eventHole;
}

export function parseCoordinate(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function yardsBetween(from: LatLng, to: LatLng): number {
  const earthRadiusM = 6_371_000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return meters * 1.09361;
}

export function buildGreenTargetsByEventHole(
  holeNumbers: number[],
  event: { holes: "9" | "18"; nineSide?: "front" | "back" | null },
  courseHoleTargets: Record<number, GreenTargets | null>
): GreenTargetsByEventHole {
  return Object.fromEntries(
    holeNumbers.map((eventHole) => {
      const courseHole = eventHoleToCourseHole(eventHole, event);
      return [eventHole, courseHoleTargets[courseHole] ?? null];
    })
  );
}

export type LiveDistances = {
  front: number | null;
  middle: number | null;
  back: number | null;
};

export function liveDistancesFromPosition(
  position: LatLng | null,
  targets: GreenTargets | null
): LiveDistances {
  if (!position || !targets) {
    return { front: null, middle: null, back: null };
  }

  return {
    front: Math.round(yardsBetween(position, targets.front)),
    middle: Math.round(yardsBetween(position, targets.middle)),
    back: Math.round(yardsBetween(position, targets.back)),
  };
}
