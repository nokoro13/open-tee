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
  const overlayRef = useRef<HoleLineOverlayInstance | null>(null);
  pathRef.current = path;
  onClickRef.current = onClick;

  useEffect(() => {
    if (!map || path.length < 2) return;

    class HoleLineOverlay extends google.maps.OverlayView {
      private container: HTMLDivElement | null = null;
      private svg: SVGSVGElement | null = null;
      private hitPath: SVGPathElement | null = null;
      private visiblePath: SVGPathElement | null = null;

      redraw() {
        this.draw();
      }

      onAdd() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.pointerEvents = clickable ? "auto" : "none";
        this.container.style.top = "0";
        this.container.style.left = "0";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.position = "absolute";
        this.svg.style.top = "0";
        this.svg.style.left = "0";
        this.svg.style.overflow = "visible";
        this.svg.style.pointerEvents = clickable ? "auto" : "none";

        if (clickable) {
          this.hitPath = createSvgPath("transparent", HOLE_LINE_HIT_WIDTH_PX);
          this.hitPath.style.cursor = "pointer";
          this.hitPath.style.pointerEvents = "stroke";
          this.hitPath.addEventListener("click", (domEvent) => {
            domEvent.stopPropagation();
            const clickHandler = onClickRef.current;
            if (!clickHandler) return;

            const mapInstance = this.getMap() as google.maps.Map | null;
            if (!mapInstance || !(domEvent instanceof MouseEvent)) return;

            const bounds = mapInstance.getDiv().getBoundingClientRect();
            const latLng = this.getProjection()?.fromDivPixelToLatLng(
              new google.maps.Point(
                domEvent.clientX - bounds.left,
                domEvent.clientY - bounds.top
              )
            );
            if (!latLng) return;

            clickHandler({
              latLng: new google.maps.LatLng(latLng.lat(), latLng.lng()),
            } as google.maps.MapMouseEvent);
          });
          this.svg.appendChild(this.hitPath);
        }

        this.visiblePath = createSvgPath("#ffffff", HOLE_LINE_WIDTH_PX);
        this.visiblePath.style.pointerEvents = "none";
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
        this.hitPath?.setAttribute("d", d);
      }

      onRemove() {
        this.container?.remove();
        this.container = null;
        this.svg = null;
        this.hitPath = null;
        this.visiblePath = null;
      }
    }

    const overlay = new HoleLineOverlay() as HoleLineOverlayInstance;
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, clickable, path.length]);

  const serializedPath = pathKey(path);

  useEffect(() => {
    overlayRef.current?.redraw();
  }, [serializedPath]);

  return null;
}
