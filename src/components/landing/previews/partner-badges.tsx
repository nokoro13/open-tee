import { PARTNER_CLUBS } from "@/lib/landing-preview-data";
import { cn } from "@/lib/utils";

export function PartnerBadges({ className }: { className?: string }) {
  return (
    <>
      {PARTNER_CLUBS.map((name) => (
        <div
          key={name}
          className={cn(
            "flex h-10 items-center justify-center rounded-lg border border-border/40 bg-background/60 px-3 sm:h-12",
            className
          )}
        >
          <span className="truncate text-xs font-medium tracking-wide text-muted-foreground sm:text-sm">
            {name}
          </span>
        </div>
      ))}
    </>
  );
}
