"use client";

import { useEffect, useState } from "react";
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  useAdvancedMarkerRef,
  useMap,
  type AdvancedMarkerRef,
} from "@vis.gl/react-google-maps";

import { ScreenSpaceGroundCircle } from "@/components/maps/screen-space-ground-circle";
import type { LatLng } from "@/lib/green-distance";

const SUPPRESS_MARKER_FOCUS_CLASS = "suppress-gmp-marker-focus";

function collectMarkerFocusElements(
  marker: NonNullable<AdvancedMarkerRef>
): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const content = marker.content;
  if (!(content instanceof HTMLElement)) return elements;

  let el: HTMLElement | null = content;
  while (el) {
    elements.push(el);
    if (el.tagName.toLowerCase() === "gmp-advanced-marker") break;
    el = el.parentElement;
  }

  return elements;
}

function useSuppressAdvancedMarkerDragFocus(marker: AdvancedMarkerRef) {
  useEffect(() => {
    if (!marker) return;

    const elements = collectMarkerFocusElements(marker);
    if (elements.length === 0) return;

    const preventMouseFocus = (event: Event) => {
      event.preventDefault();
    };

    for (const node of elements) {
      node.classList.add(SUPPRESS_MARKER_FOCUS_CLASS);
      node.addEventListener("mousedown", preventMouseFocus);
    }

    return () => {
      for (const node of elements) {
        node.classList.remove(SUPPRESS_MARKER_FOCUS_CLASS);
        node.removeEventListener("mousedown", preventMouseFocus);
      }
    };
  }, [marker]);
}

function latLngFromDragEvent(event: {
  latLng: { lat: () => number; lng: () => number } | null | undefined;
}): LatLng | null {
  const latLng = event.latLng;
  if (!latLng) return null;
  return { lat: latLng.lat(), lng: latLng.lng() };
}

const DOGLEG_OUTER_RADIUS_PX = 22;
const DOGLEG_INNER_RADIUS_PX = 4;

/** Flag SVG height at {@link FLAG_SIZE_REFERENCE_ZOOM}. */
const FLAG_SVG_HEIGHT_PX = 40;
/** Cap apparent flag height when zoomed out (pixels). */
const FLAG_MAX_HEIGHT_PX = 44;
const FLAG_SIZE_REFERENCE_ZOOM = 17;

function flagPinContentScale(zoom: number): number {
  const naturalHeight =
    FLAG_SVG_HEIGHT_PX * 2 ** (FLAG_SIZE_REFERENCE_ZOOM - zoom);
  if (naturalHeight <= FLAG_MAX_HEIGHT_PX) return 1;
  return FLAG_MAX_HEIGHT_PX / naturalHeight;
}

function useFlagPinContentScale(): number {
  const map = useMap();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!map) return;

    const update = () => {
      setScale(flagPinContentScale(map.getZoom() ?? FLAG_SIZE_REFERENCE_ZOOM));
    };

    update();
    const listener = map.addListener("zoom_changed", update);
    return () => listener.remove();
  }, [map]);

  return scale;
}

function GroundCircle({
  position,
  radiusYards,
  fixedRadiusPx,
  minRadiusPx,
  maxRadiusPx,
  fillColor,
  fillOpacity = 1,
  strokeColor,
  strokeOpacity = 1,
  strokeWeight = 2,
}: {
  position: LatLng;
  radiusYards?: number;
  fixedRadiusPx?: number;
  minRadiusPx?: number;
  maxRadiusPx?: number;
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  zIndex?: number;
}) {
  return (
    <ScreenSpaceGroundCircle
      position={position}
      radiusYards={radiusYards}
      fixedRadiusPx={fixedRadiusPx}
      minRadiusPx={minRadiusPx}
      maxRadiusPx={maxRadiusPx}
      fillColor={fillColor}
      fillOpacity={fillOpacity}
      strokeColor={strokeColor}
      strokeOpacity={strokeOpacity}
      strokeWeight={strokeWeight}
    />
  );
}

/** Pole base sits at the bottom edge so the yardage line meets the pin exactly. */
function FlagPinContent({ scale = 1 }: { scale?: number }) {
  return (
    <div
      style={{
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      <svg
        width={32}
        height={40}
        viewBox="0 0 32 40"
        aria-hidden
        className="block"
      >
        <path d="M16 2 L29 7.5 L16 14 Z" fill="#ef4444" />
        <line
          x1="16"
          y1="2"
          x2="16"
          y2="40"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function FlagPinMarker({
  position,
  zIndex = 23,
}: {
  position: LatLng;
  zIndex?: number;
}) {
  const contentScale = useFlagPinContentScale();

  return (
    <>
      <GroundCircle
        position={position}
        radiusYards={2.5}
        fillColor="#6b7280"
        fillOpacity={0.22}
        strokeColor="#ffffff"
        strokeOpacity={0.32}
        strokeWeight={2}
        zIndex={zIndex - 1}
      />
      <AdvancedMarker
        position={position}
        clickable={false}
        zIndex={zIndex}
        anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
      >
        <FlagPinContent scale={contentScale} />
      </AdvancedMarker>
    </>
  );
}

export function OriginMarker({
  position,
  fillColor,
  strokeColor,
  zIndex = 22,
}: {
  position: LatLng;
  fillColor: string;
  strokeColor: string;
  zIndex?: number;
}) {
  return (
    <AdvancedMarker
      position={position}
      clickable={false}
      zIndex={zIndex}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
    >
      <div
        className="size-6 rounded-full border-2 shadow-md"
        style={{ backgroundColor: fillColor, borderColor: strokeColor }}
      />
    </AdvancedMarker>
  );
}

export function YardageBadgeMarker({
  position,
  yards,
  zIndex = 24,
}: {
  position: LatLng;
  yards: number;
  zIndex?: number;
}) {
  return (
    <AdvancedMarker
      position={position}
      clickable={false}
      zIndex={zIndex}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
    >
      <div className="rounded-full bg-black/82 px-2.5 py-1 text-[13px] font-bold leading-none text-white shadow-md">
        {yards}
      </div>
    </AdvancedMarker>
  );
}

export function BreakAnchorMarker({
  position,
  draggable = false,
  clickable = false,
  zIndex = 30,
  title,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  position: LatLng;
  draggable?: boolean;
  clickable?: boolean;
  zIndex?: number;
  title?: string;
  onClick?: () => void;
  onDragStart?: () => void;
  onDrag?: (point: LatLng) => void;
  onDragEnd?: (point: LatLng) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  useSuppressAdvancedMarkerDragFocus(marker);

  return (
    <>
      <GroundCircle
        position={position}
        fixedRadiusPx={DOGLEG_OUTER_RADIUS_PX}
        fillColor="#000000"
        fillOpacity={0.08}
        strokeColor="#ffffff"
        strokeOpacity={1}
        strokeWeight={2.5}
        zIndex={zIndex - 1}
      />
      <GroundCircle
        position={position}
        fixedRadiusPx={DOGLEG_INNER_RADIUS_PX}
        fillColor="#ffffff"
        fillOpacity={1}
        strokeColor="#ffffff"
        strokeOpacity={1}
        strokeWeight={1}
        zIndex={zIndex}
      />
      {(draggable || clickable) && (
        <AdvancedMarker
          ref={markerRef}
          position={position}
          draggable={draggable}
          clickable={clickable}
          zIndex={zIndex + 1}
          title={title}
          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
          className={SUPPRESS_MARKER_FOCUS_CLASS}
          onClick={onClick}
          onDragStart={() => {
            if (marker) {
              for (const node of collectMarkerFocusElements(marker)) {
                node.blur();
              }
            }
            (document.activeElement as HTMLElement | null)?.blur?.();
            onDragStart?.();
          }}
          onDrag={(event) => {
            (document.activeElement as HTMLElement | null)?.blur?.();
            const point = latLngFromDragEvent(event);
            if (point) onDrag?.(point);
          }}
          onDragEnd={(event) => {
            const point = latLngFromDragEvent(event);
            if (point) onDragEnd?.(point);
            (document.activeElement as HTMLElement | null)?.blur?.();
          }}
        >
          <div
            className="size-11 cursor-grab outline-none active:cursor-grabbing"
            aria-hidden
            onMouseDown={(event) => event.preventDefault()}
          />
        </AdvancedMarker>
      )}
    </>
  );
}

export function LabeledCircleMarker({
  position,
  label,
  fill,
  stroke,
  radius,
  labelColor = "#ffffff",
  opacity = 1,
  zIndex,
  draggable = false,
  clickable = false,
  title,
  onClick,
  onDrag,
  onDragEnd,
}: {
  position: LatLng;
  label?: string;
  fill: string;
  stroke: string;
  radius: number;
  labelColor?: string;
  opacity?: number;
  zIndex?: number;
  draggable?: boolean;
  clickable?: boolean;
  title?: string;
  onClick?: () => void;
  onDrag?: (point: LatLng) => void;
  onDragEnd?: (point: LatLng) => void;
}) {
  const size = radius * 2;

  return (
    <AdvancedMarker
      position={position}
      draggable={draggable}
      clickable={clickable}
      zIndex={zIndex}
      title={title}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      onClick={onClick}
      onDrag={(event) => {
        const point = latLngFromDragEvent(event);
        if (point) onDrag?.(point);
      }}
      onDragEnd={(event) => {
        const point = latLngFromDragEvent(event);
        if (point) onDragEnd?.(point);
      }}
    >
      <div
        className="flex items-center justify-center rounded-full border-[2.5px] shadow-md"
        style={{
          width: size,
          height: size,
          opacity,
          backgroundColor: fill,
          borderColor: stroke,
        }}
      >
        {label ? (
          <span
            className="text-[10px] font-bold leading-none"
            style={{ color: labelColor }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </AdvancedMarker>
  );
}

export function PulseRingMarker({
  position,
  radius,
  zIndex = 20,
}: {
  position: LatLng;
  radius: number;
  zIndex?: number;
}) {
  const size = (radius + 5) * 2;

  return (
    <AdvancedMarker
      position={position}
      clickable={false}
      zIndex={zIndex}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
    >
      <div
        className="rounded-full bg-blue-400/22"
        style={{ width: size, height: size }}
      />
    </AdvancedMarker>
  );
}

export function FeaturePointMarker({
  position,
  fillColor,
  strokeColor,
  zIndex,
}: {
  position: LatLng;
  fillColor: string;
  strokeColor: string;
  zIndex?: number;
}) {
  return (
    <LabeledCircleMarker
      position={position}
      fill={fillColor}
      stroke={strokeColor}
      radius={4}
      zIndex={zIndex}
    />
  );
}
