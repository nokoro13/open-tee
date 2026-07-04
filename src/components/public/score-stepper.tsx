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
  /** horizontal = name beside controls; responsive = horizontal on mobile, vertical on lg+ */
  layout?: "vertical" | "horizontal" | "responsive";
  className?: string;
};

export function getDefaultScoreForHole(
  parByHole: Record<number, number>,
  hole: number
): number {
  return parByHole[hole] ?? 4;
}

function StepperControls({
  label,
  value,
  disabled,
  horizontal,
  large,
  onAdjust,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  horizontal: boolean;
  large: boolean;
  onAdjust: (delta: number) => void;
}) {
  const buttonClass = cn(
    "flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm transition-all hover:border-primary/30 hover:bg-muted active:scale-95 disabled:opacity-40",
    horizontal ? "size-12" : large ? "size-10 sm:size-14" : "size-10"
  );

  const iconClass = cn(
    "text-muted-foreground",
    horizontal ? "size-5" : large ? "size-5 sm:size-6" : "size-5"
  );

  const minusButton = (
    <button
      type="button"
      aria-label={`Decrease ${label} score`}
      disabled={disabled || value <= MIN_SCORE}
      onClick={() => onAdjust(-1)}
      className={buttonClass}
    >
      <Minus className={iconClass} />
    </button>
  );

  const plusButton = (
    <button
      type="button"
      aria-label={`Increase ${label} score`}
      disabled={disabled || value >= MAX_SCORE}
      onClick={() => onAdjust(1)}
      className={buttonClass}
    >
      <Plus className={iconClass} />
    </button>
  );

  const scoreValue = (
    <span
      className={cn(
        "select-none font-semibold tabular-nums tracking-tight",
        horizontal
          ? "min-w-[2.5ch] px-1.5 text-center text-3xl"
          : large
            ? "py-2 text-4xl sm:py-3 sm:text-6xl"
            : "py-3 text-4xl"
      )}
      aria-live="polite"
    >
      {value}
    </span>
  );

  if (horizontal) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-linear-to-b from-primary/15 to-primary/5 p-1.5 shadow-inner">
        {minusButton}
        {scoreValue}
        {plusButton}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[2rem] bg-linear-to-b from-primary/15 to-primary/5 shadow-inner",
        large ? "w-18 px-2 py-3 sm:w-24 sm:px-3 sm:py-6" : "w-18 px-2 py-3"
      )}
    >
      {plusButton}
      {scoreValue}
      {minusButton}
    </div>
  );
}

export function ScoreStepper({
  label,
  value,
  par,
  disabled,
  onChange,
  size = "default",
  layout = "vertical",
  className,
}: ScoreStepperProps) {
  const hint = par != null ? formatHoleScoreLabel(value, par) : null;
  const large = size === "large";

  function adjust(delta: number) {
    if (disabled) return;
    onChange(Math.min(MAX_SCORE, Math.max(MIN_SCORE, value + delta)));
  }

  const horizontalRow = (
    <div
      className={cn(
        "flex w-full shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-2.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold leading-snug">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <StepperControls
        label={label}
        value={value}
        disabled={disabled}
        horizontal
        large={large}
        onAdjust={adjust}
      />
    </div>
  );

  const verticalColumn = (
    <div className={cn("flex flex-col items-center", className)}>
      <p
        className={cn(
          "mb-3 max-w-44 text-center font-semibold leading-tight",
          large ? "text-sm sm:text-base" : "text-sm"
        )}
      >
        {label}
      </p>
      <div className="relative inline-flex shrink-0">
        <StepperControls
          label={label}
          value={value}
          disabled={disabled}
          horizontal={false}
          large={large}
          onAdjust={adjust}
        />
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

  if (layout === "responsive") {
    return (
      <>
        <div className="w-full shrink-0 lg:hidden">{horizontalRow}</div>
        <div className="hidden lg:block">{verticalColumn}</div>
      </>
    );
  }

  if (layout === "horizontal") {
    return horizontalRow;
  }

  return verticalColumn;
}
