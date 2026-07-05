"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export const DESKTOP_NATIVE_WIDTH = 1280;

type PreviewScaleProps = {
  nativeWidth: number;
  nativeHeight: number;
  className?: string;
  interactive?: boolean;
  /** "width" scales to container width; "contain" fits within width and height */
  fit?: "width" | "contain";
  children: React.ReactNode;
};

type Size = { width: number; height: number };

/**
 * Renders children at a fixed native size, then scales uniformly.
 * With fit="contain", nothing can paint outside the measured box.
 */
export function PreviewScale({
  nativeWidth,
  nativeHeight,
  className,
  interactive = false,
  fit = "width",
  children,
}: PreviewScaleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    function measure() {
      const rect = element!.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }

    measure();

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale =
    containerSize != null && containerSize.width > 0
      ? fit === "contain"
        ? containerSize.height > 0
          ? Math.min(
              containerSize.width / nativeWidth,
              containerSize.height / nativeHeight
            )
          : null
        : containerSize.width / nativeWidth
      : null;

  const displayWidth = scale != null ? nativeWidth * scale : undefined;
  const displayHeight = scale != null ? nativeHeight * scale : undefined;

  const isContain = fit === "contain";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        isContain ? "h-full w-full overflow-hidden" : "w-full",
        className
      )}
      style={isContain ? undefined : { height: displayHeight }}
    >
      {scale != null &&
      displayWidth != null &&
      displayHeight != null &&
      containerSize != null ? (
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{
            width: containerSize.width,
            height: isContain ? containerSize.height : displayHeight,
          }}
        >
          <div
            className={cn(
              "origin-top-left",
              !interactive && "pointer-events-none select-none"
            )}
            style={{
              width: nativeWidth,
              height: nativeHeight,
              transform: `scale(${scale})`,
            }}
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
