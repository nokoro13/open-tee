"use client";

import type { HandicapView } from "@/lib/scorecard-handicap-rows";
import { cn } from "@/lib/utils";

type HandicapRowToggleProps = {
  view: HandicapView;
  onChange: (view: HandicapView) => void;
  className?: string;
};

export function HandicapRowToggle({
  view,
  onChange,
  className,
}: HandicapRowToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border text-[10px] font-medium text-foreground",
        className
      )}
      role="group"
      aria-label="Handicap row"
    >
      <button
        type="button"
        className={cn(
          "px-1.5 py-0.5 transition-colors",
          view === "mens" ? "bg-muted text-foreground" : "hover:bg-muted/60"
        )}
        aria-pressed={view === "mens"}
        onClick={() => onChange("mens")}
      >
        Men
      </button>
      <button
        type="button"
        className={cn(
          "border-l px-1.5 py-0.5 transition-colors",
          view === "ladies" ? "bg-muted text-foreground" : "hover:bg-muted/60"
        )}
        aria-pressed={view === "ladies"}
        onClick={() => onChange("ladies")}
      >
        Ladies
      </button>
    </div>
  );
}
