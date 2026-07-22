"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const INITIAL_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 15_000,
};

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

function toPosition(coords: GeolocationCoordinates): GeolocationPosition {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
  };
}

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
      (result) => handleSuccess(toPosition(result.coords)),
      handleError,
      WATCH_OPTIONS
    );

    pollIdRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (result) => handleSuccess(toPosition(result.coords)),
        () => {
          // Keep the last known position if a poll fails.
        },
        POLL_OPTIONS
      );
    }, 2_000);
  }, [handleError, handleSuccess]);

  const requestLocation = useCallback(() => {
    if (!enabledRef.current) return;
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    if (hasFixRef.current && trackingRef.current) {
      return;
    }

    setStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        handleSuccess(toPosition(result.coords));
        startTracking();
      },
      handleError,
      INITIAL_OPTIONS
    );
  }, [handleError, handleSuccess, startTracking]);

  useEffect(() => {
    if (!enabled) {
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

    let cancelled = false;

    async function syncPermissionState() {
      if (!navigator.permissions?.query) {
        if (!cancelled) setStatus("idle");
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: "geolocation" });
        if (cancelled) return;

        if (result.state === "granted") {
          requestLocation();
        } else if (result.state === "denied") {
          setStatus("denied");
        } else {
          setStatus("idle");
        }

        result.onchange = () => {
          if (cancelled) return;
          if (result.state === "granted") {
            requestLocation();
          } else if (result.state === "denied") {
            setStatus("denied");
            stopTracking();
            hasFixRef.current = false;
            setPosition(null);
          } else {
            setStatus("idle");
          }
        };
      } catch {
        if (!cancelled) setStatus("idle");
      }
    }

    void syncPermissionState();

    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [enabled, requestLocation, stopTracking]);

  return { position, status, requestLocation };
}
