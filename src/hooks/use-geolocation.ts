"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  GEOLOCATION_INITIAL_OPTIONS,
  requestGeolocationFromUserGesture,
  setGeolocationControllerHandlers,
} from "@/lib/geolocation-controller";

export type GeolocationPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export type GeolocationStatus =
  | "idle"
  | "locating"
  | "live"
  | "denied"
  | "unavailable";

export { requestGeolocationFromUserGesture };

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 20_000,
};

const POLL_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 10_000,
};

export function useGeolocation(enabled = true) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const hasFixRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const pollIdRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pollIdRef.current != null) {
      window.clearInterval(pollIdRef.current);
      pollIdRef.current = null;
    }
    trackingRef.current = false;
  }, []);

  const handleSuccess = useCallback((coords: GeolocationPosition) => {
    hasFixRef.current = true;
    setPosition(coords);
    setStatus("live");
  }, []);

  const handleError = useCallback(
    (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setStatus("denied");
        stopTracking();
        return;
      }

      if (!hasFixRef.current) {
        setStatus("unavailable");
      }
    },
    [stopTracking]
  );

  const startTracking = useCallback(() => {
    if (!enabledRef.current || !navigator.geolocation || trackingRef.current) {
      return;
    }

    trackingRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (result) =>
        handleSuccess({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          handleError(error);
        }
      },
      WATCH_OPTIONS
    );

    pollIdRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (result) =>
          handleSuccess({
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
          }),
        () => {
          // Keep the last known position if a poll fails.
        },
        POLL_OPTIONS
      );
    }, 2_000);
  }, [handleError, handleSuccess]);

  const startTrackingRef = useRef(startTracking);
  startTrackingRef.current = startTracking;

  useEffect(() => {
    if (!enabled) {
      setGeolocationControllerHandlers(null);
      stopTracking();
      hasFixRef.current = false;
      setStatus("idle");
      setPosition(null);
      return;
    }

    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    setGeolocationControllerHandlers({
      canRequest: () =>
        enabledRef.current &&
        !(hasFixRef.current && trackingRef.current),
      onStart: () => {
        setStatus("locating");
      },
      onSuccess: (coords) => {
        handleSuccess(coords);
        startTrackingRef.current();
      },
      onError: handleError,
    });

    return () => {
      setGeolocationControllerHandlers(null);
      stopTracking();
    };
  }, [enabled, handleError, handleSuccess, stopTracking]);

  return {
    position,
    status,
    requestLocation: requestGeolocationFromUserGesture,
  };
}
