"use client";

import type { LatLng } from "@/lib/green-distance";
import { ScreenSpaceHoleLine } from "@/components/maps/screen-space-hole-line";

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
    <ScreenSpaceHoleLine
      path={path}
      clickable={clickable}
      onClick={onClick}
    />
  );
}
