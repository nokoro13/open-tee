import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EventTabHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function EventTabHeader({
  title,
  description,
  actions,
  className,
}: EventTabHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
