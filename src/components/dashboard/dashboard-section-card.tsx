import { cn } from "@/lib/utils";

type DashboardSectionCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  headerFooter?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function DashboardSectionCard({
  icon: Icon,
  title,
  description,
  children,
  headerExtra,
  headerFooter,
  className,
  style,
}: DashboardSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
      style={style}
    >
      <div className="shrink-0 border-b bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {description}
              </p>
            </div>
          </div>
          {headerExtra}
        </div>
        {headerFooter}
      </div>
      {children}
    </section>
  );
}
