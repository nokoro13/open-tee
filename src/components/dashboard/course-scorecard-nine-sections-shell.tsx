import type { ReactNode } from "react";

import type { ScorecardNineSection } from "@/components/dashboard/course-scorecard-sections";

type CourseScorecardNineSectionsShellProps = {
  sections: ScorecardNineSection[];
  children: (section: ScorecardNineSection) => ReactNode;
};

export function CourseScorecardNineSectionsShell({
  sections,
  children,
}: CourseScorecardNineSectionsShellProps) {
  const isSplitNine = sections.length > 1;

  if (!isSplitNine) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        {children(sections[0]!)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div
          key={section.label ?? "nine"}
          className="overflow-hidden rounded-lg border bg-card"
        >
          {children(section)}
        </div>
      ))}
    </div>
  );
}

type ScorecardNineSectionHeaderProps = {
  label: string | null;
  par: number;
};

export function ScorecardNineSectionHeader({
  label,
  par,
}: ScorecardNineSectionHeaderProps) {
  if (!label) return null;

  return (
    <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <span>{label} nine</span>
      <span className="normal-case tracking-normal tabular-nums">Par {par}</span>
    </div>
  );
}

export function scorecardNineSectionTableClassName(): string {
  return "min-w-full border-collapse text-sm";
}

export const SCORECARD_TABLE_BODY = "divide-y divide-border/50";
