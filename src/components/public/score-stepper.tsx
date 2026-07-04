"use client";

import { Minus, Plus } from "lucide-react";

import { formatHoleScoreLabel } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

const MIN_SCORE = 1;
const MAX_SCORE = 20;

type ScoreStepperProps = {
  label: string;
  value: number;
  par?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  size?: "default" | "large";
  className?: string;
};

export function getDefaultScoreForHole(
  parByHole: Record<number, number>,
  hole: number
): number {
  return parByHole[hole] ?? 4;
}

export function ScoreStepper({
  label,
  value,
  par,
  disabled,
  onChange,
  size = "default",
  className,
}: ScoreStepperProps) {
  const hint = par != null ? formatHoleScoreLabel(value, par) : null;
  const large = size === "large";

  function adjust(delta: number) {
    if (disabled) return;
    onChange(Math.min(MAX_SCORE, Math.max(MIN_SCORE, value + delta)));
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <p
        className={cn(
          "mb-3 max-w-[9rem] text-center font-semibold leading-tight sm:max-w-[11rem]",
          large ? "text-sm sm:text-base" : "text-sm"
        )}
      >
        {label}
      </p>
      <div className="relative inline-flex shrink-0">
        <div
          className={cn(
            "flex flex-col items-center rounded-[2rem] bg-gradient-to-b from-primary/15 to-primary/5 shadow-inner",
            large
              ? "w-18 px-2 py-3 sm:w-24 sm:px-3 sm:py-6"
              : "w-[4.5rem] px-2 py-3"
          )}
        >
        <button
          type="button"
          aria-label={`Increase ${label} score`}
          disabled={disabled || value >= MAX_SCORE}
          onClick={() => adjust(1)}
          className={cn(
            "flex items-center justify-center rounded-full border border-border/60 bg-background shadow-sm transition-all hover:border-primary/30 hover:bg-muted active:scale-95 disabled:opacity-40",
            large ? "size-10 sm:size-14" : "size-10"
          )}
        >
          <Plus
            className={cn("text-muted-foreground", large ? "size-5 sm:size-6" : "size-5")}
          />
        </button>
        <span
          className={cn(
            "select-none font-semibold tabular-nums tracking-tight",
            large ? "py-2 text-4xl sm:py-3 sm:text-6xl" : "py-3 text-4xl"
          )}
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Decrease ${label} score`}
          disabled={disabled || value <= MIN_SCORE}
          onClick={() => adjust(-1)}
          className={cn(
            "flex items-center justify-center rounded-full border border-border/60 bg-background shadow-sm transition-all hover:border-primary/30 hover:bg-muted active:scale-95 disabled:opacity-40",
            large ? "size-10 sm:size-14" : "size-10"
          )}
        >
          <Minus
            className={cn("text-muted-foreground", large ? "size-5 sm:size-6" : "size-5")}
          />
        </button>
        </div>
      {hint && (
        <span
          className={cn(
            "absolute top-1/2 left-full ml-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground sm:ml-3 sm:px-2.5",
            large ? "text-xs sm:text-sm" : "text-xs"
          )}
        >
          {hint}
        </span>
      )}
      </div>
    </div>
  );
}
