import { cn } from "@/lib/utils";

const SIZES = {
  sm: 28,
  md: 32,
} as const;

type OpenRoundMarkProps = {
  size?: keyof typeof SIZES;
  className?: string;
};

export function OpenRoundMark({ size = "md", className }: OpenRoundMarkProps) {
  const px = SIZES[size];

  return (
    <img
      src="/icon0.svg"
      alt=""
      width={px}
      height={px}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden
    />
  );
}
