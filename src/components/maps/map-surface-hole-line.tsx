"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

import {
  HOLE_LINE_HIT_WIDTH_PX,
  HOLE_LINE_WIDTH_PX,
} from "@/lib/hole-line-styles";
import type { LatLng } from "@/lib/green-distance";

function pathKey(path: LatLng[]): string {
  return path.map((point) => `${point.lat},${point.lng}`).join("|");
}

function toPathLiteral(path: LatLng[]): google.maps.LatLngLiteral[] {
  return path.map((point) => ({ lat: point.lat, lng: point.lng }));
}

type MapSurfaceHoleLineProps = {
  path: LatLng[];
  clickable?: boolean;
  onClick?: (event: google.maps.MapMouseEvent) => void;
};

/**
 * Renders yardage lines as native map polylines so they follow map tilt/zoom
 * correctly. Screen-space SVG lines break when an endpoint falls behind the
 * camera at high zoom.
 */
export function MapSurfaceHoleLine({
  path,
  clickable = false,
  onClick,
}: MapSurfaceHoleLineProps) {
  const map = useMap();
  const pathRef = useRef(path);
  const onClickRef = useRef(onClick);
  const visibleLineRef = useRef<google.maps.Polyline | null>(null);
  const hitLineRef = useRef<google.maps.Polyline | null>(null);
  pathRef.current = path;
  onClickRef.current = onClick;

  useEffect(() => {
    if (!map || path.length < 2) return;

    const visibleLine = new google.maps.Polyline({
      path: toPathLiteral(pathRef.current),
      strokeColor: "#ffffff",
      strokeOpacity: 1,
      strokeWeight: HOLE_LINE_WIDTH_PX,
      clickable: false,
      zIndex: 12,
      map,
    });
    visibleLineRef.current = visibleLine;

    let hitLine: google.maps.Polyline | null = null;
    if (clickable) {
      hitLine = new google.maps.Polyline({
        path: toPathLiteral(pathRef.current),
        strokeColor: "#ffffff",
        strokeOpacity: 0,
        strokeWeight: HOLE_LINE_HIT_WIDTH_PX,
        clickable: true,
        zIndex: 13,
        map,
      });
      hitLine.addListener("click", (event: google.maps.MapMouseEvent) => {
        onClickRef.current?.(event);
      });
      hitLineRef.current = hitLine;
    }

    return () => {
      visibleLine.setMap(null);
      visibleLineRef.current = null;
      hitLine?.setMap(null);
      hitLineRef.current = null;
    };
  }, [map, clickable, path.length]);

  const serializedPath = pathKey(path);

  useEffect(() => {
    const literal = toPathLiteral(pathRef.current);
    visibleLineRef.current?.setPath(literal);
    hitLineRef.current?.setPath(literal);
  }, [serializedPath]);

  return null;
}
