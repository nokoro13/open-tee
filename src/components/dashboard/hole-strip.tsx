"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type HoleStripProps = {
  holes: number[];
  activeHole: number;
  onSelect: (holeNumber: number) => void;
  isHoleComplete?: (holeNumber: number) => boolean;
  className?: string;
};

/**
 * Horizontally scrolling hole selector for small screens. Keeps the active
 * hole centered as the user navigates.
 */
export function HoleStrip({
  holes,
  activeHole,
  onSelect,
  isHoleComplete,
  className,
}: HoleStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const button = activeRef.current;
    if (!container || !button) return;

    container.scrollTo({
      left: button.offsetLeft - container.clientWidth / 2 + button.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activeHole]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex gap-1.5 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="tablist"
      aria-label="Holes"
    >
      {holes.map((holeNumber) => {
        const complete = isHoleComplete?.(holeNumber) ?? false;
        const isActive = activeHole === holeNumber;

        return (
          <button
            key={holeNumber}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(holeNumber)}
            className={cn(
              "relative flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background text-foreground ring-1 ring-foreground/10 active:bg-muted",
              complete && !isActive && "ring-primary/40"
            )}
          >
            {holeNumber}
            {complete && (
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-card",
                  isActive ? "bg-primary-foreground" : "bg-primary"
                )}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
