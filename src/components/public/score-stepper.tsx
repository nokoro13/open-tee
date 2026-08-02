"use client";

import { Minus, Plus } from "lucide-react";

import {
  scoreResultLabel,
  scoreResultTone,
} from "@/components/public/mobile-scoring-ui";
import { cn } from "@/lib/utils";

const MIN_SCORE = 1;
const MAX_SCORE = 20;

type ScoreStepperProps = {
  label: string;
  caption?: string;
  value: number;
  par?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  size?: "default" | "large";
  layout?: "vertical" | "horizontal" | "responsive";
  forceMobileLayout?: boolean;
  className?: string;
};

export function getDefaultScoreForHole(
  parByHole: Record<number, number>,
  hole: number
): number {
  return parByHole[hole] ?? 4;
}

function HorizontalControls({
  label,
  value,
  disabled,
  large,
  onAdjust,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  large: boolean;
  onAdjust: (delta: number) => void;
}) {
  const buttonClass = cn(
    "flex shrink-0 items-center justify-center rounded-full border border-border/50 bg-background shadow-sm transition-all hover:border-primary/40 hover:bg-muted active:scale-95 disabled:opacity-40",
    "size-12"
  );

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-linear-to-b from-muted/30 to-muted/10 p-1 shadow-inner">
      <button
        type="button"
        aria-label={`Decrease ${label} score`}
        disabled={disabled || value <= MIN_SCORE}
        onClick={() => onAdjust(-1)}
        className={buttonClass}
      >
        <Minus className="size-5 text-foreground/70" />
      </button>
      <span
        className="min-w-[2.5ch] select-none px-1.5 text-center text-lg font-semibold tabular-nums tracking-tight text-foreground"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label} score`}
        disabled={disabled || value >= MAX_SCORE}
        onClick={() => onAdjust(1)}
        className={buttonClass}
      >
        <Plus className="size-5 text-foreground/70" />
      </button>
    </div>
  );
}

function VerticalControls({
  label,
  value,
  disabled,
  large,
  onAdjust,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  large: boolean;
  onAdjust: (delta: number) => void;
}) {
  const buttonClass = cn(
    "flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm transition-all hover:border-primary/30 hover:bg-muted active:scale-95 disabled:opacity-40",
    large ? "size-10 sm:size-14" : "size-10"
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[2rem] bg-linear-to-b from-primary/15 to-primary/5 shadow-inner",
        large ? "w-18 px-2 py-3 sm:w-24 sm:px-3 sm:py-6" : "w-18 px-2 py-3"
      )}
    >
      <button
        type="button"
        aria-label={`Increase ${label} score`}
        disabled={disabled || value >= MAX_SCORE}
        onClick={() => onAdjust(1)}
        className={buttonClass}
      >
        <Plus className={cn("text-muted-foreground", large ? "size-5 sm:size-6" : "size-5")} />
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
        onClick={() => onAdjust(-1)}
        className={buttonClass}
      >
        <Minus className={cn("text-muted-foreground", large ? "size-5 sm:size-6" : "size-5")} />
      </button>
    </div>
  );
}

export function ScoreStepper({
  label,
  caption,
  value,
  par,
  disabled,
  onChange,
  size = "default",
  layout = "vertical",
  forceMobileLayout = false,
  className,
}: ScoreStepperProps) {
  const large = size === "large";
  const resultLabel = par != null ? scoreResultLabel(value, par) : null;
  const resultTone = par != null ? scoreResultTone(value, par) : "";

  function adjust(delta: number) {
    if (disabled) return;
    onChange(Math.min(MAX_SCORE, Math.max(MIN_SCORE, value + delta)));
  }

  const teamMemberNames =
    caption && label.includes(" & ") ? label.split(" & ").filter(Boolean) : null;

  const nameBlock = teamMemberNames ? (
    <div className="space-y-0.5">
      {teamMemberNames.map((name) => (
        <p
          key={name}
          className="text-sm font-semibold leading-snug break-words text-foreground"
        >
          {name}
        </p>
      ))}
    </div>
  ) : (
    <p className="text-sm font-semibold leading-snug break-words text-foreground sm:text-base">
      {label}
    </p>
  );

  const mobileRow = (
    <div
      className={cn(
        "flex w-full shrink-0 items-start gap-3 px-4 py-3.5",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {caption ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {caption}
          </p>
        ) : null}
        {nameBlock}
        {resultLabel ? (
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
              resultTone
            )}
          >
            {resultLabel}
          </span>
        ) : null}
      </div>
      <div className="shrink-0 self-center">
        <HorizontalControls
          label={label}
          value={value}
          disabled={disabled}
          large={large}
          onAdjust={adjust}
        />
      </div>
    </div>
  );

  const horizontalRow = (
    <div
      className={cn(
        "flex w-full shrink-0 items-start gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {caption ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {caption}
          </p>
        ) : null}
        {nameBlock}
        {resultLabel ? (
          <p className="text-sm font-medium text-muted-foreground">{resultLabel}</p>
        ) : null}
      </div>
      <div className="shrink-0 self-center">
        <HorizontalControls
          label={label}
          value={value}
          disabled={disabled}
          large={large}
          onAdjust={adjust}
        />
      </div>
    </div>
  );

  const verticalColumn = (
    <div className={cn("flex flex-col items-center", className)}>
      {caption ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {caption}
        </p>
      ) : null}
      {teamMemberNames ? (
        <div className="mb-3 max-w-48 space-y-0.5 text-center">
          {teamMemberNames.map((name) => (
            <p
              key={name}
              className={cn(
                "font-semibold leading-snug break-words",
                large ? "text-sm sm:text-base" : "text-sm"
              )}
            >
              {name}
            </p>
          ))}
        </div>
      ) : (
        <p
          className={cn(
            "mb-3 max-w-44 text-center font-semibold leading-tight break-words",
            large ? "text-sm sm:text-base" : "text-sm"
          )}
        >
          {label}
        </p>
      )}
      <VerticalControls
        label={label}
        value={value}
        disabled={disabled}
        large={large}
        onAdjust={adjust}
      />
    </div>
  );

  if (layout === "responsive") {
    if (forceMobileLayout) {
      return mobileRow;
    }
    return (
      <>
        <div className="w-full shrink-0 lg:hidden">{mobileRow}</div>
        <div className="hidden lg:block">{verticalColumn}</div>
      </>
    );
  }

  if (layout === "horizontal") {
    return horizontalRow;
  }

  return verticalColumn;
}
