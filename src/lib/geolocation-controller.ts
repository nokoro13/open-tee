import type { GeolocationPosition } from "@/hooks/use-geolocation";

export const GEOLOCATION_INITIAL_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 30_000,
  timeout: 20_000,
};

type GeolocationControllerHandlers = {
  onStart: () => void;
  onSuccess: (position: GeolocationPosition) => void;
  onError: (error: GeolocationPositionError) => void;
  canRequest: () => boolean;
};

let handlers: GeolocationControllerHandlers | null = null;
let lastGestureRequestAt = 0;

export function setGeolocationControllerHandlers(
  next: GeolocationControllerHandlers | null
): void {
  handlers = next;
}

/**
 * Invoke geolocation synchronously from a user gesture (click/touch/pointer).
 * Must be called directly in the event handler — do not defer with setState first.
 */
export function requestGeolocationFromUserGesture(): void {
  const now = Date.now();
  if (now - lastGestureRequestAt < 400) return;
  lastGestureRequestAt = now;

  if (!handlers?.canRequest()) return;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    handlers.onStart();
    handlers.onError({
      code: 2,
      message: "Geolocation is not available",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);
    return;
  }

  // Call getCurrentPosition before any React state updates (Safari user activation).
  navigator.geolocation.getCurrentPosition(
    (result) => {
      handlers?.onSuccess({
        lat: result.coords.latitude,
        lng: result.coords.longitude,
        accuracy: result.coords.accuracy,
      });
    },
    (error) => {
      handlers?.onError(error);
    },
    GEOLOCATION_INITIAL_OPTIONS
  );

  handlers.onStart();
}

export function runWithGeolocationUserGesture(action?: () => void): void {
  requestGeolocationFromUserGesture();
  action?.();
}
