"use client";

import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
} from "@vis.gl/react-google-maps";

import type { LatLng } from "@/lib/green-distance";

function latLngFromDragEvent(
  event: google.maps.MapMouseEvent
): LatLng | null {
  const latLng = event.latLng;
  if (!latLng) return null;
  return { lat: latLng.lat(), lng: latLng.lng() };
}

/** Pole base sits at the bottom edge so the yardage line meets the pin exactly. */
function FlagPinContent() {
  return (
    <div className="relative flex flex-col items-center">
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 z-0 size-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/30 bg-gray-500/20 shadow-sm"
      />
      <svg
        width={32}
        height={40}
        viewBox="0 0 32 40"
        aria-hidden
        className="relative z-10 block"
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
  return (
    <AdvancedMarker
      position={position}
      clickable={false}
      zIndex={zIndex}
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
    >
      <FlagPinContent />
    </AdvancedMarker>
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
  return (
    <AdvancedMarker
      position={position}
      draggable={draggable}
      clickable={clickable}
      zIndex={zIndex}
      title={title}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      onClick={onClick}
      onDragStart={onDragStart}
      onDrag={(event) => {
        const point = latLngFromDragEvent(event);
        if (point) onDrag?.(point);
      }}
      onDragEnd={(event) => {
        const point = latLngFromDragEvent(event);
        if (point) onDragEnd?.(point);
      }}
    >
      <div className="flex size-[30px] cursor-grab items-center justify-center rounded-full border-[2.5px] border-white shadow-md active:cursor-grabbing">
        <div className="size-[5px] rounded-full bg-white" />
      </div>
    </AdvancedMarker>
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
