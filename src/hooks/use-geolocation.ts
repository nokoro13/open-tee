"use client";

import { useEffect, useRef, useState } from "react";

export type GeolocationPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export type GeolocationStatus = "idle" | "locating" | "live" | "denied" | "unavailable";

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20_000,
};

const POLL_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
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

  useEffect(() => {
    if (!enabled) {
      hasFixRef.current = false;
      setStatus("idle");
      setPosition(null);
      return;
    }

    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    hasFixRef.current = false;
    setStatus("locating");

    const handleSuccess = (coords: GeolocationPosition) => {
      hasFixRef.current = true;
      setPosition(coords);
      setStatus("live");
    };

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setStatus("denied");
      } else if (!hasFixRef.current) {
        setStatus("unavailable");
      }
    };

    navigator.geolocation.getCurrentPosition(
      (result) => handleSuccess(toPosition(result.coords)),
      handleError,
      POLL_OPTIONS
    );

    const watchId = navigator.geolocation.watchPosition(
      (result) => handleSuccess(toPosition(result.coords)),
      handleError,
      WATCH_OPTIONS
    );

    const pollId = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (result) => handleSuccess(toPosition(result.coords)),
        () => {
          // Keep the last known position if a poll fails.
        },
        POLL_OPTIONS
      );
    }, 2_000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(pollId);
    };
  }, [enabled]);

  return { position, status };
}
