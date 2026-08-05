"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

import type { LatLng } from "@/lib/green-distance";
import { circlePolygonPathYards } from "@/lib/map-ground-circle";

function latLngToLiteral(point: LatLng): google.maps.LatLngLiteral {
  return { lat: point.lat, lng: point.lng };
}

function ringToSvgD(
  projection: google.maps.MapCanvasProjection,
  ring: LatLng[]
): string | null {
  const segments: string[] = [];

  for (const point of ring) {
    const pixel = projection.fromLatLngToDivPixel(latLngToLiteral(point));
    if (!pixel) return null;
    segments.push(`${segments.length === 0 ? "M" : "L"} ${pixel.x} ${pixel.y}`);
  }

  if (segments.length === 0) return null;
  return `${segments.join(" ")} Z`;
}

function averageProjectedRadiusPx(
  projection: google.maps.MapCanvasProjection,
  center: LatLng,
  radiusYards: number
): number | null {
  const centerPixel = projection.fromLatLngToDivPixel(latLngToLiteral(center));
  if (!centerPixel) return null;

  const ring = circlePolygonPathYards(center, radiusYards, 32);
  if (ring.length === 0) return null;

  let sum = 0;
  let count = 0;
  for (const point of ring) {
    const pixel = projection.fromLatLngToDivPixel(latLngToLiteral(point));
    if (!pixel) continue;
    sum += Math.hypot(pixel.x - centerPixel.x, pixel.y - centerPixel.y);
    count += 1;
  }

  return count > 0 ? sum / count : null;
}

function resolveRadiusYards(
  projection: google.maps.MapCanvasProjection,
  center: LatLng,
  radiusYards: number,
  minRadiusPx?: number,
  maxRadiusPx?: number
): number {
  if (!minRadiusPx && !maxRadiusPx) return radiusYards;

  const projectedPx = averageProjectedRadiusPx(projection, center, radiusYards);
  if (projectedPx == null || projectedPx <= 0) return radiusYards;

  if (minRadiusPx && projectedPx < minRadiusPx) {
    return radiusYards * (minRadiusPx / projectedPx);
  }

  if (maxRadiusPx && projectedPx > maxRadiusPx) {
    return radiusYards * (maxRadiusPx / projectedPx);
  }

  return radiusYards;
}

type CircleStyle = {
  position: LatLng;
  radiusYards: number;
  fixedRadiusPx?: number;
  minRadiusPx?: number;
  maxRadiusPx?: number;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
};

type GroundCircleOverlayInstance = google.maps.OverlayView & {
  redraw: () => void;
};

export type ScreenSpaceGroundCircleProps = {
  position: LatLng;
  radiusYards?: number;
  /** Always render at this on-screen radius (pixels), regardless of zoom. */
  fixedRadiusPx?: number;
  /** Grow the on-map circle when zoomed out so it stays readable/tappable. */
  minRadiusPx?: number;
  /** Shrink the on-map circle when zoomed in so it does not dominate the fairway. */
  maxRadiusPx?: number;
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeOpacity?: number;
  strokeWeight?: number;
};

export function ScreenSpaceGroundCircle({
  position,
  radiusYards = 1,
  fixedRadiusPx,
  minRadiusPx,
  maxRadiusPx,
  fillColor,
  fillOpacity = 1,
  strokeColor,
  strokeOpacity = 1,
  strokeWeight = 2,
}: ScreenSpaceGroundCircleProps) {
  const map = useMap();
  const styleRef = useRef<CircleStyle>({
    position,
    radiusYards,
    fixedRadiusPx,
    minRadiusPx,
    maxRadiusPx,
    fillColor,
    fillOpacity,
    strokeColor,
    strokeOpacity,
    strokeWeight,
  });
  const overlayRef = useRef<GroundCircleOverlayInstance | null>(null);

  styleRef.current = {
    position,
    radiusYards,
    fixedRadiusPx,
    minRadiusPx,
    maxRadiusPx,
    fillColor,
    fillOpacity,
    strokeColor,
    strokeOpacity,
    strokeWeight,
  };

  useEffect(() => {
    if (!map) return;

    class GroundCircleOverlay extends google.maps.OverlayView {
      private container: HTMLDivElement | null = null;
      private svg: SVGSVGElement | null = null;
      private shape: SVGPathElement | null = null;

      redraw() {
        this.draw();
      }

      onAdd() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.pointerEvents = "none";
        this.container.style.top = "0";
        this.container.style.left = "0";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.position = "absolute";
        this.svg.style.top = "0";
        this.svg.style.left = "0";
        this.svg.style.overflow = "visible";
        this.svg.style.pointerEvents = "none";

        this.shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.svg.appendChild(this.shape);

        this.container.appendChild(this.svg);
        this.getPanes()?.overlayLayer.appendChild(this.container);
      }

      draw() {
        const projection = this.getProjection();
        const mapInstance = this.getMap() as google.maps.Map | null;
        if (!projection || !mapInstance || !this.svg || !this.shape) return;

        const style = styleRef.current;
        const effectiveRadiusYards = style.fixedRadiusPx
          ? resolveRadiusYards(
              projection,
              style.position,
              1,
              style.fixedRadiusPx,
              style.fixedRadiusPx
            )
          : resolveRadiusYards(
              projection,
              style.position,
              style.radiusYards,
              style.minRadiusPx,
              style.maxRadiusPx
            );
        const ring = circlePolygonPathYards(style.position, effectiveRadiusYards);
        const d = ringToSvgD(projection, ring);
        if (!d) return;

        const mapDiv = mapInstance.getDiv();
        const width = mapDiv.offsetWidth;
        const height = mapDiv.offsetHeight;

        this.container!.style.width = `${width}px`;
        this.container!.style.height = `${height}px`;
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));

        this.shape.setAttribute("d", d);
        this.shape.setAttribute("fill", style.fillColor);
        this.shape.setAttribute("fill-opacity", String(style.fillOpacity));
        this.shape.setAttribute("stroke", style.strokeColor);
        this.shape.setAttribute("stroke-opacity", String(style.strokeOpacity));
        this.shape.setAttribute("stroke-width", String(style.strokeWeight));
        this.shape.setAttribute("stroke-linejoin", "round");
      }

      onRemove() {
        this.container?.remove();
        this.container = null;
        this.svg = null;
        this.shape = null;
      }
    }

    const overlay = new GroundCircleOverlay() as GroundCircleOverlayInstance;
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const redraw = () => {
      overlayRef.current?.redraw();
    };

    const listeners = [
      map.addListener("bounds_changed", redraw),
      map.addListener("zoom_changed", redraw),
      map.addListener("heading_changed", redraw),
      map.addListener("tilt_changed", redraw),
    ];

    return () => {
      for (const listener of listeners) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [map]);

  useEffect(() => {
    overlayRef.current?.redraw();
  }, [
    position.lat,
    position.lng,
    radiusYards,
    fixedRadiusPx,
    minRadiusPx,
    maxRadiusPx,
    fillColor,
    fillOpacity,
    strokeColor,
    strokeOpacity,
    strokeWeight,
  ]);

  return null;
}
