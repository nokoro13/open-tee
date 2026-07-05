import { cn } from "@/lib/utils";

type PreviewBrowserFrameProps = {
  url?: string;
  className?: string;
  children: React.ReactNode;
};

export function PreviewBrowserFrame({
  url = "openround.app/dashboard",
  className,
  children,
}: PreviewBrowserFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-background shadow-xl ring-1 ring-border/50",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <div className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="mx-auto min-w-0 flex-1 truncate rounded-md bg-background/80 px-3 py-1 text-center text-[11px] text-muted-foreground">
          {url}
        </div>
        <div className="size-2.5 shrink-0 opacity-0" aria-hidden />
      </div>
      <div className="relative overflow-hidden bg-background">{children}</div>
    </div>
  );
}
