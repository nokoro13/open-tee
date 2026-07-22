"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

import {
  flyHoleMapCamera,
  snapHoleMapCamera,
} from "@/lib/hole-map-camera-animation";
import {
  computeHoleMapCamera,
  type HoleMapCameraPadding,
  type HoleMapView,
} from "@/lib/hole-map-view";

export type FitHoleOptions = {
  animate?: boolean;
};

type HoleMapCameraControllerProps = {
  view: HoleMapView;
  resetKey: number;
  padding: HoleMapCameraPadding;
  enabled?: boolean;
  onReady?: (fitHole: (options?: FitHoleOptions) => void) => void;
};

export function HoleMapCameraController({
  view,
  resetKey,
  padding,
  enabled = true,
  onReady,
}: HoleMapCameraControllerProps) {
  const map = useMap();
  const viewRef = useRef(view);
  const enabledRef = useRef(enabled);
  const paddingRef = useRef(padding);
  const hasInitialFitRef = useRef(false);
  const prevResetKeyRef = useRef(resetKey);
  const pendingFlyHoleRef = useRef<number | null>(null);
  const cancelFlyRef = useRef<(() => void) | null>(null);
  const isFlyingRef = useRef(false);
  const userAdjustedCameraRef = useRef(false);
  const isProgrammaticCameraRef = useRef(false);

  viewRef.current = view;
  enabledRef.current = enabled;
  paddingRef.current = padding;

  const stopFly = useCallback(() => {
    cancelFlyRef.current?.();
    cancelFlyRef.current = null;
    isFlyingRef.current = false;
  }, []);

  const markProgrammaticCamera = useCallback(() => {
    isProgrammaticCameraRef.current = true;
    requestAnimationFrame(() => {
      isProgrammaticCameraRef.current = false;
    });
  }, []);

  const applyCamera = useCallback(
    (animate: boolean, { force = false }: { force?: boolean } = {}) => {
      if (!map) return false;

      if (isFlyingRef.current && !force && !animate) {
        return true;
      }

      const div = map.getDiv();
      const rect = div.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) return false;

      if (isFlyingRef.current && force) {
        stopFly();
      }

      const currentView = viewRef.current;

      if (!enabledRef.current) {
        stopFly();
        markProgrammaticCamera();
        snapHoleMapCamera(map, {
          center: currentView.center,
          zoom: 17,
          heading: 0,
        });
        hasInitialFitRef.current = true;
        pendingFlyHoleRef.current = null;
        return true;
      }

      const camera = computeHoleMapCamera({
        view: currentView,
        mapWidth: Math.max(rect.width, 1),
        mapHeight: Math.max(rect.height, 1),
        padding: paddingRef.current,
      });

      const shouldAnimate = animate && hasInitialFitRef.current;

      if (shouldAnimate) {
        if (isFlyingRef.current) {
          stopFly();
        }

        isFlyingRef.current = true;
        isProgrammaticCameraRef.current = true;
        cancelFlyRef.current = flyHoleMapCamera(map, camera, {
          onComplete: () => {
            isFlyingRef.current = false;
            isProgrammaticCameraRef.current = false;
            cancelFlyRef.current = null;
            pendingFlyHoleRef.current = null;
          },
        });
      } else {
        if (isFlyingRef.current) {
          return true;
        }

        stopFly();
        markProgrammaticCamera();
        snapHoleMapCamera(map, camera);
        if (animate) {
          pendingFlyHoleRef.current = null;
        }
      }

      hasInitialFitRef.current = true;
      return true;
    },
    [map, stopFly, markProgrammaticCamera]
  );

  const fitHole = useCallback(
    (options?: FitHoleOptions) => {
      userAdjustedCameraRef.current = false;
      const animate = options?.animate ?? false;
      applyCamera(animate, { force: true });
    },
    [applyCamera]
  );

  useEffect(() => {
    onReady?.(fitHole);
  }, [fitHole, onReady]);

  useEffect(() => {
    if (!map) return;

    const markUserAdjusted = () => {
      if (isProgrammaticCameraRef.current || isFlyingRef.current) return;
      userAdjustedCameraRef.current = true;
    };

    const zoomListener = map.addListener("zoom_changed", markUserAdjusted);
    const dragListener = map.addListener("dragend", markUserAdjusted);

    return () => {
      google.maps.event.removeListener(zoomListener);
      google.maps.event.removeListener(dragListener);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const holeChanged = prevResetKeyRef.current !== resetKey;
    if (holeChanged) {
      prevResetKeyRef.current = resetKey;
      pendingFlyHoleRef.current = resetKey;
      userAdjustedCameraRef.current = false;
      stopFly();
    }

    const hasGeometry = view.green != null || view.tee != null;
    if (!hasGeometry) return;

    if (!hasInitialFitRef.current) {
      applyCamera(false);
      return;
    }

    const wantsFly =
      pendingFlyHoleRef.current === resetKey && !userAdjustedCameraRef.current;

    if (wantsFly) {
      applyCamera(true);
    }
  }, [
    map,
    resetKey,
    applyCamera,
    stopFly,
    view.bearing,
    view.tee?.lat,
    view.tee?.lng,
    view.green?.lat,
    view.green?.lng,
    enabled,
  ]);

  useEffect(() => {
    if (!map) return;

    const onResize = () => {
      if (isFlyingRef.current || userAdjustedCameraRef.current) return;
      applyCamera(false);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(map.getDiv());

    return () => {
      resizeObserver.disconnect();
    };
  }, [map, applyCamera]);

  useEffect(() => () => stopFly(), [stopFly]);

  return null;
}
