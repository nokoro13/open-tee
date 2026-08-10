import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow && (
          <p className="truncate text-sm font-medium text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
