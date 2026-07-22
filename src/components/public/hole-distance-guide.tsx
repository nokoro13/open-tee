"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline } from "@vis.gl/react-google-maps";

import { useHoleDoglegPreferences } from "@/hooks/use-hole-dogleg-preferences";
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

const LINE_HIT_OPTIONS = {
  strokeColor: "#ffffff",
  strokeOpacity: 0.001,
  strokeWeight: 24,
  zIndex: 17,
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

  function handleBreakDrag(event: google.maps.MapMouseEvent) {
    const point = latLngFromMapEvent(event);
    if (!point) return;
    setDragBreak(point);
  }

  function handleBreakDragEnd(event: google.maps.MapMouseEvent) {
    const point = latLngFromMapEvent(event);
    if (!point || !canEdit) return;
    setDragBreak(null);
    setBreakPoint(holeNumber, point);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  if (!hasDogleg || !breakPoint) {
    return (
      <>
        {canEdit && (
          <Polyline
            path={[guide.from, guide.to]}
            {...LINE_HIT_OPTIONS}
            clickable
            onClick={handleAddBreak}
          />
        )}

        <Polyline
          path={[guide.from, guide.to]}
          {...DISTANCE_LINE_OPTIONS}
          clickable={false}
        />

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
        draggable={canEdit}
        clickable={canEdit}
        zIndex={30}
        title={
          canEdit
            ? "Tap to remove · drag to adjust layup"
            : "Fairway layup target"
        }
        icon={breakIcon}
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
