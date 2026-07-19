"use client";

import { useEffect, useMemo, useState } from "react";
import { Marker, Polyline } from "@vis.gl/react-google-maps";

import { teeMarkerStrokeColor } from "@/lib/course-tees";
import type { LatLng } from "@/lib/green-distance";
import type { HoleDistanceGuide } from "@/lib/hole-distance-guide";
import {
  createBreakAnchorIcon,
  createFlagPinIcon,
  createYardageBadgeIcon,
  midpoint,
  segmentYards,
  startPointIcon,
} from "@/lib/hole-distance-guide";

const DISTANCE_LINE_OPTIONS = {
  strokeColor: "#ffffff",
  strokeOpacity: 1,
  strokeWeight: 3,
  zIndex: 18,
} as const;

function SegmentYardageLabel({
  from,
  to,
}: {
  from: LatLng;
  to: LatLng;
}) {
  const yards = segmentYards(from, to);
  const icon = useMemo(() => createYardageBadgeIcon(yards), [yards]);

  return (
    <Marker
      position={midpoint(from, to)}
      clickable={false}
      zIndex={24}
      icon={icon}
    />
  );
}

type HoleDistanceGuideLayerProps = {
  guide: HoleDistanceGuide;
  holeNumber: number;
};

export function HoleDistanceGuideLayer({
  guide,
  holeNumber,
}: HoleDistanceGuideLayerProps) {
  const [dragBreak, setDragBreak] = useState<LatLng | null>(null);
  const mappedBreak = guide.lineBreak;
  const breakPoint = dragBreak ?? mappedBreak;
  const hasDogleg = breakPoint != null;
  const breakIcon = useMemo(() => createBreakAnchorIcon(), []);
  const flagIcon = useMemo(() => createFlagPinIcon(), []);
  const originIcon = useMemo(
    () =>
      guide.fromKind === "player"
        ? startPointIcon()
        : startPointIcon({
            fillColor: guide.teeColor,
            strokeColor: teeMarkerStrokeColor(guide.teeColor),
          }),
    [guide.fromKind, guide.teeColor]
  );

  useEffect(() => {
    setDragBreak(null);
  }, [holeNumber, mappedBreak?.lat, mappedBreak?.lng]);

  if (!hasDogleg || !breakPoint) {
    return (
      <>
        <Polyline path={[guide.from, guide.to]} {...DISTANCE_LINE_OPTIONS} />

        <Marker
          position={guide.from}
          clickable={false}
          zIndex={22}
          icon={originIcon}
        />

        <Marker
          position={guide.to}
          clickable={false}
          zIndex={23}
          icon={flagIcon}
        />

        <SegmentYardageLabel from={guide.from} to={guide.to} />
      </>
    );
  }

  return (
    <>
      <Polyline path={[guide.from, breakPoint]} {...DISTANCE_LINE_OPTIONS} />
      <Polyline path={[breakPoint, guide.to]} {...DISTANCE_LINE_OPTIONS} />

      <Marker
        position={guide.from}
        clickable={false}
        zIndex={22}
        icon={originIcon}
      />

      <Marker
        position={guide.to}
        clickable={false}
        zIndex={23}
        icon={flagIcon}
      />

      <SegmentYardageLabel from={guide.from} to={breakPoint} />
      <SegmentYardageLabel from={breakPoint} to={guide.to} />

      <Marker
        position={breakPoint}
        draggable
        zIndex={30}
        title="Drag to set a layup target on the fairway"
        icon={breakIcon}
        onDrag={(event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          setDragBreak({ lat: latLng.lat(), lng: latLng.lng() });
        }}
        onDragEnd={(event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          setDragBreak({ lat: latLng.lat(), lng: latLng.lng() });
        }}
      />
    </>
  );
}
