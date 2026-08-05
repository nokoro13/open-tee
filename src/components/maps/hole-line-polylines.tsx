"use client";

import type { LatLng } from "@/lib/green-distance";
import { MapSurfaceHoleLine } from "@/components/maps/map-surface-hole-line";

type HoleLinePolylinesProps = {
  path: LatLng[];
  clickable?: boolean;
  onClick?: (event: google.maps.MapMouseEvent) => void;
};

export function HoleLinePolylines({
  path,
  clickable = false,
  onClick,
}: HoleLinePolylinesProps) {
  return (
    <MapSurfaceHoleLine
      path={path}
      clickable={clickable}
      onClick={onClick}
    />
  );
}
