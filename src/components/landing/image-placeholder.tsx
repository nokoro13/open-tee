import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const aspectClasses = {
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[21/9]",
  portrait: "aspect-[3/4]",
} as const;

type ImagePlaceholderProps = {
  label?: string;
  aspectRatio?: keyof typeof aspectClasses;
  className?: string;
};

export function ImagePlaceholder({
  label = "Image placeholder",
  aspectRatio = "video",
  className,
}: ImagePlaceholderProps) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40",
        aspectClasses[aspectRatio],
        className
      )}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <ImageIcon className="size-8 opacity-40" strokeWidth={1.5} />
        <span className="text-xs font-medium tracking-wide uppercase opacity-60">
          {label}
        </span>
      </div>
    </div>
  );
}
