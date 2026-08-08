import {
  getCombinationTeeColors,
  type TeeColorLike,
} from "@/lib/course-tees";
import { cn } from "@/lib/utils";

type CombinationTeeIconProps = {
  teeKey: string;
  teeName: string;
  allTees: TeeColorLike[];
  className?: string;
};

export function CombinationTeeIcon({
  teeKey,
  teeName,
  allTees,
  className = "size-2",
}: CombinationTeeIconProps) {
  const colors = getCombinationTeeColors({ teeKey, teeName }, allTees);
  if (!colors) return null;

  const [leftColor, rightColor] = colors;

  return (
    <svg
      viewBox="0 0 12 12"
      className={cn("inline-block shrink-0", className)}
      aria-hidden
    >
      {/* Left semicircle */}
      <path d="M6 0 A6 6 0 0 0 6 12 Z" fill={leftColor} />
      {/* Right semicircle */}
      <path d="M6 0 A6 6 0 0 1 6 12 Z" fill={rightColor} />
      <circle
        cx="6"
        cy="6"
        r="5.5"
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
      />
    </svg>
  );
}

type CombinationTeeLabelProps = {
  teeKey: string;
  teeName: string;
  allTees: TeeColorLike[];
  className?: string;
  iconClassName?: string;
};

export function CombinationTeeLabel({
  teeKey,
  teeName,
  allTees,
  className,
  iconClassName,
}: CombinationTeeLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <CombinationTeeIcon
        teeKey={teeKey}
        teeName={teeName}
        allTees={allTees}
        className={iconClassName}
      />
      {teeName}
    </span>
  );
}

/** @deprecated Use CombinationTeeLabel */
export const CombinationTeeName = CombinationTeeLabel;
