import { useCallback, useEffect, useRef, useState } from "react";

export type DiagramViewport = {
  scale: number;
  panX: number;
  panY: number;
};

export const DEFAULT_DIAGRAM_VIEWPORT: DiagramViewport = {
  scale: 1,
  panX: 0,
  panY: 0,
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;

export function clampDiagramViewport(
  viewport: DiagramViewport,
  width: number,
  height: number
): DiagramViewport {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.scale));

  if (scale <= 1) {
    return DEFAULT_DIAGRAM_VIEWPORT;
  }

  const maxPanX = (scale - 1) * width * 0.48;
  const maxPanY = (scale - 1) * height * 0.48;

  return {
    scale,
    panX: Math.max(-maxPanX, Math.min(maxPanX, viewport.panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, viewport.panY)),
  };
}

export function applyDiagramViewportTransform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: DiagramViewport
) {
  const centerX = width / 2;
  const centerY = height / 2;
  ctx.translate(centerX + viewport.panX, centerY + viewport.panY);
  ctx.scale(viewport.scale, viewport.scale);
  ctx.translate(-centerX, -centerY);
}

function screenToWorld(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  viewport: DiagramViewport
) {
  const centerX = width / 2;
  const centerY = height / 2;
  return {
    x: centerX + (screenX - centerX - viewport.panX) / viewport.scale,
    y: centerY + (screenY - centerY - viewport.panY) / viewport.scale,
  };
}

function zoomAtPoint(
  viewport: DiagramViewport,
  width: number,
  height: number,
  screenX: number,
  screenY: number,
  nextScale: number
): DiagramViewport {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));
  const world = screenToWorld(screenX, screenY, width, height, viewport);
  const centerX = width / 2;
  const centerY = height / 2;

  return clampDiagramViewport(
    {
      scale,
      panX: screenX - centerX - (world.x - centerX) * scale,
      panY: screenY - centerY - (world.y - centerY) * scale,
    },
    width,
    height
  );
}

function touchDistance(touches: TouchList) {
  if (touches.length < 2) return 0;
  const first = touches[0]!;
  const second = touches[1]!;
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  return Math.hypot(dx, dy);
}

function touchCenter(touches: TouchList, rect: DOMRect) {
  if (touches.length < 2) {
    const touch = touches[0]!;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  const first = touches[0]!;
  const second = touches[1]!;
  return {
    x: (first.clientX + second.clientX) / 2 - rect.left,
    y: (first.clientY + second.clientY) / 2 - rect.top,
  };
}

function isViewportAdjusted(viewport: DiagramViewport) {
  return (
    viewport.scale !== DEFAULT_DIAGRAM_VIEWPORT.scale ||
    viewport.panX !== DEFAULT_DIAGRAM_VIEWPORT.panX ||
    viewport.panY !== DEFAULT_DIAGRAM_VIEWPORT.panY
  );
}

type UseDiagramViewportOptions = {
  enabled: boolean;
  resetKey: string | number;
};

export function useDiagramViewport({
  enabled,
  resetKey,
}: UseDiagramViewportOptions) {
  const viewportRef = useRef<DiagramViewport>(DEFAULT_DIAGRAM_VIEWPORT);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [isAdjusted, setIsAdjusted] = useState(false);

  const syncAdjusted = useCallback((viewport: DiagramViewport) => {
    setIsAdjusted(isViewportAdjusted(viewport));
  }, []);

  const resetViewport = useCallback(() => {
    viewportRef.current = DEFAULT_DIAGRAM_VIEWPORT;
    syncAdjusted(DEFAULT_DIAGRAM_VIEWPORT);
  }, [syncAdjusted]);

  useEffect(() => {
    if (!enabled) return;
    resetViewport();
  }, [enabled, resetKey, resetViewport]);

  const setViewport = useCallback(
    (next: DiagramViewport) => {
      const clamped = clampDiagramViewport(
        next,
        sizeRef.current.width,
        sizeRef.current.height
      );
      viewportRef.current = clamped;
      syncAdjusted(clamped);
    },
    [syncAdjusted]
  );

  const bindViewportElement = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !enabled) return;

      let pinchStartDistance = 0;
      let pinchStartViewport: DiagramViewport = DEFAULT_DIAGRAM_VIEWPORT;
      let panStartX = 0;
      let panStartY = 0;
      let panOriginX = 0;
      let panOriginY = 0;
      let isPanning = false;
      let isPinching = false;

      const updateSize = () => {
        const rect = element.getBoundingClientRect();
        sizeRef.current = {
          width: Math.max(rect.width, 1),
          height: Math.max(rect.height, 1),
        };
      };

      updateSize();

      const localPoint = (clientX: number, clientY: number) => {
        const rect = element.getBoundingClientRect();
        return {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
      };

      const onTouchStart = (event: TouchEvent) => {
        updateSize();
        if (event.touches.length === 2) {
          isPinching = true;
          isPanning = false;
          pinchStartDistance = touchDistance(event.touches);
          pinchStartViewport = { ...viewportRef.current };
        } else if (event.touches.length === 1 && viewportRef.current.scale > 1) {
          isPanning = true;
          isPinching = false;
          const touch = event.touches[0]!;
          panStartX = touch.clientX;
          panStartY = touch.clientY;
          panOriginX = viewportRef.current.panX;
          panOriginY = viewportRef.current.panY;
        }
      };

      const onTouchMove = (event: TouchEvent) => {
        updateSize();
        const { width, height } = sizeRef.current;
        if (width === 0 || height === 0) return;

        if (event.touches.length === 2) {
          event.preventDefault();
          isPinching = true;
          isPanning = false;

          const distance = touchDistance(event.touches);
          if (pinchStartDistance <= 0) {
            pinchStartDistance = distance;
            pinchStartViewport = { ...viewportRef.current };
          }

          const rect = element.getBoundingClientRect();
          const center = touchCenter(event.touches, rect);
          const nextScale =
            pinchStartViewport.scale * (distance / pinchStartDistance);
          setViewport(
            zoomAtPoint(
              pinchStartViewport,
              width,
              height,
              center.x,
              center.y,
              nextScale
            )
          );
          return;
        }

        if (isPanning && event.touches.length === 1) {
          event.preventDefault();
          const touch = event.touches[0]!;
          setViewport({
            ...viewportRef.current,
            panX: panOriginX + (touch.clientX - panStartX),
            panY: panOriginY + (touch.clientY - panStartY),
          });
        }
      };

      const onTouchEnd = () => {
        if (isPinching) {
          pinchStartDistance = 0;
        }
        isPanning = false;
        isPinching = false;
      };

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        updateSize();
        const { width, height } = sizeRef.current;
        if (width === 0 || height === 0) return;

        const point = localPoint(event.clientX, event.clientY);
        const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
        setViewport(
          zoomAtPoint(
            viewportRef.current,
            width,
            height,
            point.x,
            point.y,
            viewportRef.current.scale * zoomFactor
          )
        );
      };

      const onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0 || viewportRef.current.scale <= 1) return;
        isPanning = true;
        panStartX = event.clientX;
        panStartY = event.clientY;
        panOriginX = viewportRef.current.panX;
        panOriginY = viewportRef.current.panY;
      };

      const onMouseMove = (event: MouseEvent) => {
        if (!isPanning) return;
        setViewport({
          ...viewportRef.current,
          panX: panOriginX + (event.clientX - panStartX),
          panY: panOriginY + (event.clientY - panStartY),
        });
      };

      const onMouseUp = () => {
        isPanning = false;
      };

      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("touchmove", onTouchMove, { passive: false });
      element.addEventListener("touchend", onTouchEnd);
      element.addEventListener("touchcancel", onTouchEnd);
      element.addEventListener("wheel", onWheel, { passive: false });
      element.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(element);

      return () => {
        element.removeEventListener("touchstart", onTouchStart);
        element.removeEventListener("touchmove", onTouchMove);
        element.removeEventListener("touchend", onTouchEnd);
        element.removeEventListener("touchcancel", onTouchEnd);
        element.removeEventListener("wheel", onWheel);
        element.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        resizeObserver.disconnect();
      };
    },
    [enabled, setViewport]
  );

  return {
    viewportRef,
    bindViewportElement,
    resetViewport,
    isAdjusted,
  };
}
