"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

import {
  HOLE_LINE_HIT_WIDTH_PX,
  HOLE_LINE_WIDTH_PX,
} from "@/lib/hole-line-styles";
import type { LatLng } from "@/lib/green-distance";

function latLngToLiteral(point: LatLng): google.maps.LatLngLiteral {
  return { lat: point.lat, lng: point.lng };
}

function pathKey(path: LatLng[]): string {
  return path.map((point) => `${point.lat},${point.lng}`).join("|");
}

function pathToSvgD(
  projection: google.maps.MapCanvasProjection,
  path: LatLng[]
): string | null {
  const segments: string[] = [];

  for (const point of path) {
    const pixel = projection.fromLatLngToDivPixel(latLngToLiteral(point));
    if (!pixel) return null;
    segments.push(`${segments.length === 0 ? "M" : "L"} ${pixel.x} ${pixel.y}`);
  }

  return segments.join(" ");
}

function createSvgPath(stroke: string, strokeWidth: number): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", stroke);
  path.setAttribute("stroke-width", String(strokeWidth));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  return path;
}

function clientPointFromEvent(
  domEvent: Event
): { x: number; y: number } | null {
  if (domEvent instanceof MouseEvent) {
    return { x: domEvent.clientX, y: domEvent.clientY };
  }

  if (domEvent instanceof TouchEvent) {
    const touch = domEvent.changedTouches[0] ?? domEvent.touches[0];
    if (!touch) return null;
    return { x: touch.clientX, y: touch.clientY };
  }

  return null;
}

function divPixelFromSvgEvent(
  svg: SVGSVGElement,
  domEvent: Event
): google.maps.Point | null {
  const client = clientPointFromEvent(domEvent);
  if (!client) return null;

  const inverse = svg.getScreenCTM()?.inverse();
  if (!inverse) return null;

  const pt = svg.createSVGPoint();
  pt.x = client.x;
  pt.y = client.y;
  const local = pt.matrixTransform(inverse);
  return new google.maps.Point(local.x, local.y);
}

function closestPointOnSegment(
  start: google.maps.Point,
  end: google.maps.Point,
  point: google.maps.Point
): google.maps.Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return new google.maps.Point(start.x, start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq)
  );

  return new google.maps.Point(start.x + t * dx, start.y + t * dy);
}

function latLngFromDivPixelClick(
  projection: google.maps.MapCanvasProjection,
  path: LatLng[],
  domEvent: Event,
  svg: SVGSVGElement
): google.maps.LatLng | null {
  const clickPixel = divPixelFromSvgEvent(svg, domEvent);
  if (!clickPixel) return null;

  const segmentPixels = path
    .map((point) => projection.fromLatLngToDivPixel(latLngToLiteral(point)))
    .filter((pixel): pixel is google.maps.Point => pixel != null);

  if (segmentPixels.length < 2) return null;

  let nearest = clickPixel;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (let index = 0; index < segmentPixels.length - 1; index += 1) {
    const start = segmentPixels[index]!;
    const end = segmentPixels[index + 1]!;
    const snapped = closestPointOnSegment(start, end, clickPixel);
    const dx = snapped.x - clickPixel.x;
    const dy = snapped.y - clickPixel.y;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = snapped;
    }
  }

  const latLng = projection.fromDivPixelToLatLng(nearest);
  return latLng ? new google.maps.LatLng(latLng.lat(), latLng.lng()) : null;
}

type HoleLineOverlayInstance = google.maps.OverlayView & {
  redraw: () => void;
};

type ScreenSpaceHoleLineProps = {
  path: LatLng[];
  clickable?: boolean;
  onClick?: (event: google.maps.MapMouseEvent) => void;
};

export function ScreenSpaceHoleLine({
  path,
  clickable = false,
  onClick,
}: ScreenSpaceHoleLineProps) {
  const map = useMap();
  const pathRef = useRef(path);
  const onClickRef = useRef(onClick);
  const visibleOverlayRef = useRef<HoleLineOverlayInstance | null>(null);
  const hitOverlayRef = useRef<HoleLineOverlayInstance | null>(null);
  pathRef.current = path;
  onClickRef.current = onClick;

  useEffect(() => {
    if (!map || path.length < 2) return;

    class VisibleHoleLineOverlay extends google.maps.OverlayView {
      private container: HTMLDivElement | null = null;
      private svg: SVGSVGElement | null = null;
      private visiblePath: SVGPathElement | null = null;

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

        this.visiblePath = createSvgPath("#ffffff", HOLE_LINE_WIDTH_PX);
        this.svg.appendChild(this.visiblePath);

        this.container.appendChild(this.svg);
        this.getPanes()?.overlayLayer.appendChild(this.container);
      }

      draw() {
        const projection = this.getProjection();
        const mapInstance = this.getMap() as google.maps.Map | null;
        if (!projection || !mapInstance || !this.svg || !this.visiblePath) return;

        const mapDiv = mapInstance.getDiv();
        const width = mapDiv.offsetWidth;
        const height = mapDiv.offsetHeight;

        this.container!.style.width = `${width}px`;
        this.container!.style.height = `${height}px`;
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));

        const d = pathToSvgD(projection, pathRef.current);
        if (!d) return;

        this.visiblePath.setAttribute("d", d);
      }

      onRemove() {
        this.container?.remove();
        this.container = null;
        this.svg = null;
        this.visiblePath = null;
      }
    }

    class HitHoleLineOverlay extends google.maps.OverlayView {
      private container: HTMLDivElement | null = null;
      private svg: SVGSVGElement | null = null;
      private hitPath: SVGPathElement | null = null;

      redraw() {
        this.draw();
      }

      onAdd() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.pointerEvents = "auto";
        this.container.style.top = "0";
        this.container.style.left = "0";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.position = "absolute";
        this.svg.style.top = "0";
        this.svg.style.left = "0";
        this.svg.style.overflow = "visible";
        this.svg.style.pointerEvents = "auto";

        this.hitPath = createSvgPath("transparent", HOLE_LINE_HIT_WIDTH_PX);
        this.hitPath.style.cursor = "pointer";
        this.hitPath.style.pointerEvents = "stroke";

        const handleActivate = (domEvent: Event) => {
          domEvent.stopPropagation();
          domEvent.preventDefault();

          const clickHandler = onClickRef.current;
          if (!clickHandler || !this.svg) return;

          const projection = this.getProjection();
          if (!projection) return;

          const latLng = latLngFromDivPixelClick(
            projection,
            pathRef.current,
            domEvent,
            this.svg
          );
          if (!latLng) return;

          clickHandler({ latLng } as google.maps.MapMouseEvent);
        };

        this.hitPath.addEventListener("click", handleActivate);
        this.hitPath.addEventListener("touchend", handleActivate, {
          passive: false,
        });
        this.svg.appendChild(this.hitPath);

        this.container.appendChild(this.svg);
        // overlayMouseTarget receives DOM events; overlayLayer does not.
        this.getPanes()?.overlayMouseTarget.appendChild(this.container);
      }

      draw() {
        const projection = this.getProjection();
        const mapInstance = this.getMap() as google.maps.Map | null;
        if (!projection || !mapInstance || !this.svg || !this.hitPath) return;

        const mapDiv = mapInstance.getDiv();
        const width = mapDiv.offsetWidth;
        const height = mapDiv.offsetHeight;

        this.container!.style.width = `${width}px`;
        this.container!.style.height = `${height}px`;
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));

        const d = pathToSvgD(projection, pathRef.current);
        if (!d) return;

        this.hitPath.setAttribute("d", d);
      }

      onRemove() {
        this.container?.remove();
        this.container = null;
        this.svg = null;
        this.hitPath = null;
      }
    }

    const visibleOverlay = new VisibleHoleLineOverlay() as HoleLineOverlayInstance;
    visibleOverlay.setMap(map);
    visibleOverlayRef.current = visibleOverlay;

    let hitOverlay: HoleLineOverlayInstance | null = null;
    if (clickable) {
      hitOverlay = new HitHoleLineOverlay() as HoleLineOverlayInstance;
      hitOverlay.setMap(map);
      hitOverlayRef.current = hitOverlay;
    }

    return () => {
      visibleOverlay.setMap(null);
      visibleOverlayRef.current = null;
      hitOverlay?.setMap(null);
      hitOverlayRef.current = null;
    };
  }, [map, clickable, path.length]);

  const serializedPath = pathKey(path);

  useEffect(() => {
    visibleOverlayRef.current?.redraw();
    hitOverlayRef.current?.redraw();
  }, [serializedPath]);

  return null;
}
