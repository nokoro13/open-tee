"use client";

import { useEffect, useRef, useState } from "react";

import { HoleLinePolylines } from "@/components/maps/hole-line-polylines";
import {
  BreakAnchorMarker,
  FlagPinMarker,
  OriginMarker,
  YardageBadgeMarker,
} from "@/components/maps/hole-map-markers";
import { useHoleDoglegPreferences } from "@/hooks/use-hole-dogleg-preferences";
import { teeMarkerStrokeColor } from "@/lib/course-tees";
import type { LatLng } from "@/lib/green-distance";
import type { HoleDistanceGuide } from "@/lib/hole-distance-guide";
import { midpoint, segmentYards } from "@/lib/hole-distance-guide";

function SegmentYardageLabel({
  from,
  to,
}: {
  from: LatLng;
  to: LatLng;
}) {
  const yards = segmentYards(from, to);

  return (
    <YardageBadgeMarker position={midpoint(from, to)} yards={yards} />
  );
}

function latLngFromMapEvent(event: google.maps.MapMouseEvent): LatLng | null {
  const latLng = event.latLng;
  if (!latLng) return null;
  return { lat: latLng.lat(), lng: latLng.lng() };
}

type HoleDistanceGuideLayerProps = {
  guide: HoleDistanceGuide;
  holeNumber: number;
  eventSlug?: string;
  editable?: boolean;
};

export function HoleDistanceGuideLayer({
  guide,
  holeNumber,
  eventSlug,
  editable = false,
}: HoleDistanceGuideLayerProps) {
  const { resolveBreak, setBreakPoint, clearBreakPoint } =
    useHoleDoglegPreferences(eventSlug ?? "");
  const [dragBreak, setDragBreak] = useState<LatLng | null>(null);
  const draggedRef = useRef(false);

  const mappedBreak = guide.lineBreak;
  const storedBreak = eventSlug
    ? resolveBreak(holeNumber, mappedBreak)
    : mappedBreak;
  const breakPoint = dragBreak ?? storedBreak;
  const hasDogleg = breakPoint != null;
  const canEdit = editable && Boolean(eventSlug);

  const originFill =
    guide.fromKind === "player" ? "#ef4444" : guide.teeColor;
  const originStroke =
    guide.fromKind === "player"
      ? "#ffffff"
      : teeMarkerStrokeColor(guide.teeColor);

  useEffect(() => {
    setDragBreak(null);
    draggedRef.current = false;
  }, [holeNumber, mappedBreak?.lat, mappedBreak?.lng, storedBreak?.lat, storedBreak?.lng]);

  function handleAddBreak(event: google.maps.MapMouseEvent) {
    if (!canEdit) return;
    const point = latLngFromMapEvent(event);
    if (!point) return;
    setDragBreak(null);
    setBreakPoint(holeNumber, point);
  }

  function handleRemoveBreak() {
    if (!canEdit || draggedRef.current) return;
    setDragBreak(null);
    clearBreakPoint(holeNumber);
  }

  function handleBreakDrag(point: LatLng) {
    setDragBreak(point);
  }

  function handleBreakDragEnd(point: LatLng) {
    if (!canEdit) return;
    setDragBreak(null);
    setBreakPoint(holeNumber, point);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  if (!hasDogleg || !breakPoint) {
    return (
      <>
        <HoleLinePolylines
          path={[guide.from, guide.to]}
          clickable={canEdit}
          onClick={handleAddBreak}
        />

        <OriginMarker
          position={guide.from}
          fillColor={originFill}
          strokeColor={originStroke}
        />

        <FlagPinMarker position={guide.to} />

        <SegmentYardageLabel from={guide.from} to={guide.to} />
      </>
    );
  }

  return (
    <>
      <HoleLinePolylines path={[guide.from, breakPoint]} />
      <HoleLinePolylines path={[breakPoint, guide.to]} />

      <OriginMarker
        position={guide.from}
        fillColor={originFill}
        strokeColor={originStroke}
      />

      <FlagPinMarker position={guide.to} />

      <SegmentYardageLabel from={guide.from} to={breakPoint} />
      <SegmentYardageLabel from={breakPoint} to={guide.to} />

      <BreakAnchorMarker
        position={breakPoint}
        draggable={canEdit}
        clickable={canEdit}
        zIndex={30}
        title={
          canEdit
            ? "Tap to remove · drag to adjust layup"
            : "Fairway layup target"
        }
        onClick={handleRemoveBreak}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDrag={handleBreakDrag}
        onDragEnd={handleBreakDragEnd}
      />
    </>
  );
}
