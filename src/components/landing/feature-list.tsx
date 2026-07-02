import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type FeatureListProps = {
  items: string[];
  className?: string;
};

export function FeatureList({ items, className }: FeatureListProps) {
  return (
    <ul className={cn("space-y-2.5 sm:space-y-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm sm:gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-3 text-primary" strokeWidth={2.5} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
