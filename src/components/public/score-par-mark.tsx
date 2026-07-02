"use client";

import { getScoreParMark } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

type ScoreParMarkProps = {
  strokes: number;
  par: number;
  className?: string;
  compact?: boolean;
  children: React.ReactNode;
};

export function ScoreParMark({
  strokes,
  par,
  className,
  compact,
  children,
}: ScoreParMarkProps) {
  const mark = getScoreParMark(strokes, par);
  const size = compact ? "size-6 min-w-6" : "size-8 min-w-8";

  if (mark === "par") {
    return (
      <span className={cn("tabular-nums", className)}>{children}</span>
    );
  }

  const underPar = mark === "birdie" || mark === "eagle";
  const borderColor = underPar ? "border-primary" : "border-destructive";

  if (mark === "birdie") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border-2 tabular-nums",
          borderColor,
          size,
          className
        )}
      >
        {children}
      </span>
    );
  }

  if (mark === "eagle") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border-2 p-px tabular-nums",
          borderColor,
          size,
          className
        )}
      >
        <span
          className={cn(
            "inline-flex size-full items-center justify-center rounded-full border tabular-nums",
            borderColor
          )}
        >
          {children}
        </span>
      </span>
    );
  }

  if (mark === "bogey") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center border-2 tabular-nums",
          borderColor,
          size,
          className
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border-2 p-px tabular-nums",
        borderColor,
        size,
        className
      )}
    >
      <span
        className={cn(
          "inline-flex size-full items-center justify-center border tabular-nums",
          borderColor
        )}
      >
        {children}
      </span>
    </span>
  );
}
