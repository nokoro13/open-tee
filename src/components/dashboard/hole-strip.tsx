"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type HoleStripProps = {
  holes: number[];
  activeHole: number;
  onSelect: (holeNumber: number) => void;
  isHoleComplete?: (holeNumber: number) => boolean;
  className?: string;
};

/**
 * Horizontally scrolling hole tabs styled like event management section tabs.
 * Keeps the active hole centered on small screens.
 */
export function HoleStrip({
  holes,
  activeHole,
  onSelect,
  isHoleComplete,
  className,
}: HoleStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    const activeButton = tabRefs.current.get(activeHole);
    if (!activeButton || !scrollRef.current) return;

    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const offset =
      buttonRect.left -
      containerRect.left -
      (containerRect.width - buttonRect.width) / 2;

    container.scrollTo({
      left: container.scrollLeft + offset,
      behavior: "smooth",
    });
  }, [activeHole]);

  return (
    <nav aria-label="Holes" className={cn("relative min-w-0", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-background to-transparent sm:w-8 md:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-background to-transparent sm:w-8 md:hidden"
      />

      <div
        ref={scrollRef}
        role="tablist"
        className={cn(
          "flex min-w-0 border-b border-border",
          "overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden",
          "snap-x snap-mandatory touch-pan-x",
          "md:snap-none md:overflow-visible"
        )}
      >
        {holes.map((holeNumber) => {
          const complete = isHoleComplete?.(holeNumber) ?? false;
          const isActive = activeHole === holeNumber;

          return (
            <button
              key={holeNumber}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(holeNumber, node);
                } else {
                  tabRefs.current.delete(holeNumber);
                }
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(holeNumber)}
              className={cn(
                "relative shrink-0 snap-start border-b-2 px-3.5 py-3 text-sm font-medium tabular-nums transition-colors",
                "min-h-11 touch-manipulation whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "md:flex-1 md:px-2 md:text-center lg:px-3",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <span className="inline-flex items-center justify-center gap-1">
                {holeNumber}
                {complete && (
                  <CheckCircle2
                    className={cn(
                      "size-3 shrink-0",
                      isActive ? "text-primary" : "text-primary/70"
                    )}
                    aria-hidden
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
