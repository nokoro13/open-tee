"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
import { MAX_DOGLEG_ANCHORS, orderBreakPointsAlongPath } from "@/lib/hole-dogleg-preferences";

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

function sameLatLng(left: LatLng, right: LatLng): boolean {
  return left.lat === right.lat && left.lng === right.lng;
}

type HoleDistanceGuideLayerProps = {
  guide: HoleDistanceGuide;
  holeNumber: number;
  eventSlug?: string;
  editable?: boolean;
  onBreakChange?: (breakPoints: LatLng[]) => void;
};

export function HoleDistanceGuideLayer({
  guide,
  holeNumber,
  eventSlug,
  editable = false,
  onBreakChange,
}: HoleDistanceGuideLayerProps) {
  const { resolveBreaks, addBreakPoint, updateBreakPoint, removeBreakPoint } =
    useHoleDoglegPreferences(eventSlug ?? "");
  const [dragState, setDragState] = useState<{
    index: number;
    point: LatLng;
  } | null>(null);
  const draggedRef = useRef(false);

  const mappedBreaks = guide.lineBreaks;
  const storedBreaks = eventSlug
    ? resolveBreaks(holeNumber, mappedBreaks)
    : mappedBreaks;
  const breakPoints = useMemo(() => {
    if (!dragState) return storedBreaks;
    return storedBreaks.map((point, index) =>
      index === dragState.index ? dragState.point : point
    );
  }, [dragState, storedBreaks]);
  const canEdit = editable && Boolean(eventSlug);
  const canAddMore =
    breakPoints.length < MAX_DOGLEG_ANCHORS && dragState == null;
  const pathPoints = useMemo(
    () => [guide.from, ...breakPoints, guide.to],
    [breakPoints, guide.from, guide.to]
  );

  const originFill =
    guide.fromKind === "player" ? "#ef4444" : guide.teeColor;
  const originStroke =
    guide.fromKind === "player"
      ? "#ffffff"
      : teeMarkerStrokeColor(guide.teeColor);

  const storedBreaksKey = storedBreaks
    .map((point) => `${point.lat},${point.lng}`)
    .join("|");

  useEffect(() => {
    setDragState(null);
    draggedRef.current = false;
  }, [holeNumber, mappedBreaks, storedBreaksKey]);

  useEffect(() => {
    if (dragState) return;
    onBreakChange?.(storedBreaks);
  }, [dragState, holeNumber, onBreakChange, storedBreaks, storedBreaksKey]);

  function handleAddBreak(event: google.maps.MapMouseEvent) {
    if (!canEdit || !canAddMore) return;
    const point = latLngFromMapEvent(event);
    if (!point) return;
    setDragState(null);
    addBreakPoint(holeNumber, point, mappedBreaks, guide.from, guide.to);
    onBreakChange?.(
      orderBreakPointsAlongPath(guide.from, guide.to, [...breakPoints, point])
    );
  }

  function handleRemoveBreak(index: number) {
    if (!canEdit || draggedRef.current) return;
    setDragState(null);
    removeBreakPoint(holeNumber, index, mappedBreaks);
    onBreakChange?.(breakPoints.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleBreakDrag(index: number, point: LatLng) {
    setDragState({ index, point });
    onBreakChange?.(
      breakPoints.map((currentPoint, currentIndex) =>
        currentIndex === index ? point : currentPoint
      )
    );
  }

  function handleBreakDragEnd(index: number, point: LatLng) {
    if (!canEdit) return;
    setDragState(null);
    updateBreakPoint(
      holeNumber,
      index,
      point,
      mappedBreaks,
      guide.from,
      guide.to
    );
    onBreakChange?.(
      breakPoints.map((currentPoint, currentIndex) =>
        currentIndex === index ? point : currentPoint
      )
    );
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  return (
    <>
      {pathPoints.slice(0, -1).map((from, index) => {
        const to = pathPoints[index + 1]!;
        return (
          <HoleLinePolylines
            key={`guide-segment-${index}`}
            path={[from, to]}
            clickable={canEdit && canAddMore}
            onClick={handleAddBreak}
          />
        );
      })}

      <OriginMarker
        position={guide.from}
        fillColor={originFill}
        strokeColor={originStroke}
      />

      <FlagPinMarker position={guide.to} />

      {pathPoints.slice(0, -1).map((from, index) => {
        const to = pathPoints[index + 1]!;
        return (
          <SegmentYardageLabel
            key={`guide-yards-${index}`}
            from={from}
            to={to}
          />
        );
      })}

      {breakPoints.map((point, index) => (
        <BreakAnchorMarker
          key={`guide-anchor-${index}`}
          position={point}
          draggable={canEdit}
          clickable={canEdit}
          zIndex={50 + index}
          title={
            canEdit
              ? breakPoints.length < MAX_DOGLEG_ANCHORS
                ? "Tap to remove · drag to adjust layup"
                : "Tap to remove · drag to adjust layup (max 2 anchors)"
              : "Fairway layup target"
          }
          onClick={() => handleRemoveBreak(index)}
          onDragStart={() => {
            draggedRef.current = true;
          }}
          onDrag={(nextPoint) => {
            if (!sameLatLng(point, nextPoint)) {
              handleBreakDrag(index, nextPoint);
            }
          }}
          onDragEnd={(nextPoint) => handleBreakDragEnd(index, nextPoint)}
        />
      ))}
    </>
  );
}
