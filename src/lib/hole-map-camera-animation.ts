import type { HoleMapCamera } from "@/lib/hole-map-view";

export type FlyHoleMapCameraOptions = {
  durationMs?: number;
  onComplete?: () => void;
};

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** Shortest-path interpolation for map headings (0–360). */
function lerpHeading(start: number, end: number, t: number): number {
  const delta = ((end - start + 540) % 360) - 180;
  return (start + delta * t + 360) % 360;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function readCurrentCamera(map: google.maps.Map): HoleMapCamera {
  const center = map.getCenter()?.toJSON() ?? { lat: 0, lng: 0 };
  return {
    center,
    zoom: map.getZoom() ?? 17,
    heading: map.getHeading() ?? 0,
  };
}

function durationForFly(from: HoleMapCamera, to: HoleMapCamera): number {
  const latDelta = Math.abs(from.center.lat - to.center.lat);
  const lngDelta = Math.abs(from.center.lng - to.center.lng);
  const zoomDelta = Math.abs(from.zoom - to.zoom);
  const headingDelta = Math.abs(
    (((to.heading - from.heading + 540) % 360) - 180)
  );

  const distanceScore = (latDelta + lngDelta) * 120_000 + zoomDelta * 120;
  const spinScore = headingDelta * 4;
  return Math.min(Math.max(650, distanceScore + spinScore + 550), 1400);
}

/** Smoothly flies the map camera — returns a cancel function. */
export function flyHoleMapCamera(
  map: google.maps.Map,
  target: HoleMapCamera,
  options: FlyHoleMapCameraOptions = {}
): () => void {
  const from = readCurrentCamera(map);
  const durationMs = options.durationMs ?? durationForFly(from, target);
  const startedAt = performance.now();
  let frameId = 0;

  const step = (now: number) => {
    const rawProgress = Math.min((now - startedAt) / durationMs, 1);
    const t = easeInOutCubic(rawProgress);

    map.moveCamera({
      center: {
        lat: lerp(from.center.lat, target.center.lat, t),
        lng: lerp(from.center.lng, target.center.lng, t),
      },
      zoom: lerp(from.zoom, target.zoom, t),
      heading: lerpHeading(from.heading, target.heading, t),
      tilt: 0,
    });

    if (rawProgress < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      options.onComplete?.();
    }
  };

  frameId = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(frameId);
  };
}

export function snapHoleMapCamera(
  map: google.maps.Map,
  target: HoleMapCamera
): void {
  map.moveCamera({
    center: target.center,
    zoom: target.zoom,
    heading: target.heading,
    tilt: 0,
  });
}
