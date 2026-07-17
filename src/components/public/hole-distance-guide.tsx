"use client";

import { useEffect, useMemo, useState } from "react";
import { Marker, Polyline } from "@vis.gl/react-google-maps";

import type { HoleDistanceGuide } from "@/lib/hole-distance-guide";
import {
  createBreakAnchorIcon,
  createYardageBadgeIcon,
  midpoint,
  resolveInitialBreakPoint,
  segmentYards,
  startPointIcon,
} from "@/lib/hole-distance-guide";

const DISTANCE_LINE_OPTIONS = {
  strokeColor: "#ffffff",
  strokeOpacity: 1,
  strokeWeight: 2,
  zIndex: 18,
} as const;

function SegmentYardageLabel({
  from,
  to,
}: {
  from: HoleDistanceGuide["from"];
  to: HoleDistanceGuide["to"];
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
  const [breakPoint, setBreakPoint] = useState(() =>
    resolveInitialBreakPoint(guide.holeLinePath, guide.from, guide.to)
  );
  const breakIcon = useMemo(() => createBreakAnchorIcon(), []);

  useEffect(() => {
    setBreakPoint(
      resolveInitialBreakPoint(guide.holeLinePath, guide.from, guide.to)
    );
  }, [holeNumber]);

  const firstLegYards = segmentYards(guide.from, breakPoint);
  const secondLegYards = segmentYards(breakPoint, guide.to);

  return (
    <>
      <Polyline path={[guide.from, breakPoint]} {...DISTANCE_LINE_OPTIONS} />
      <Polyline path={[breakPoint, guide.to]} {...DISTANCE_LINE_OPTIONS} />

      <Marker
        position={guide.from}
        clickable={false}
        zIndex={22}
        icon={startPointIcon()}
      />

      <Marker
        position={guide.to}
        clickable={false}
        zIndex={23}
        icon={{
          path: 0,
          scale: 9,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        }}
      />

      <SegmentYardageLabel from={guide.from} to={breakPoint} />
      <SegmentYardageLabel from={breakPoint} to={guide.to} />

      <Marker
        position={breakPoint}
        draggable
        zIndex={30}
        title={`${firstLegYards}y · ${secondLegYards}y to pin`}
        icon={breakIcon}
        onDragEnd={(event) => {
          const latLng = event.latLng;
          if (!latLng) return;
          setBreakPoint({ lat: latLng.lat(), lng: latLng.lng() });
        }}
      />
    </>
  );
}
