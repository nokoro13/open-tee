"use client";

import { runWithGeolocationUserGesture } from "@/lib/geolocation-controller";
import type { ScoreEntryGroup } from "@/lib/scoring";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function scoreResultLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  return `+${diff}`;
}

export function scoreResultTone(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff < 0) return "bg-primary/12 text-primary border-primary/20";
  if (diff === 0) return "bg-muted/80 text-muted-foreground border-border/60";
  return "bg-destructive/10 text-destructive border-destructive/20";
}


type MobileContextBarProps = {
  selectedGroupId: string;
  selectedGroup: ScoreEntryGroup | undefined;
  groups: ScoreEntryGroup[];
  isPending: boolean;
  onGroupChange: (groupId: string) => void;
};

/** Compact group picker for marshal scorers on mobile. */
export function MobileContextBar({
  selectedGroupId,
  selectedGroup,
  groups,
  isPending,
  onGroupChange,
}: MobileContextBarProps) {
  return (
    <Select
      value={selectedGroupId}
      disabled={isPending}
      onValueChange={(value) => value && onGroupChange(value)}
    >
      <SelectTrigger className="h-11 w-full rounded-2xl border-border/60 bg-card px-3.5 text-base font-semibold shadow-sm">
        <SelectValue>{selectedGroup?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            {group.label}
            {group.players.length > 1 ? ` (${group.players.length} players)` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type MobileHoleHeroProps = {
  activeHole: number;
  totalHoles: number;
  par: number;
  yardage?: number | null;
  onOpenHoleMap?: () => void;
};

const GPS_BUTTON_SIZE = "size-[4.5rem]";

function HoleStatPill({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-18 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center shadow-sm backdrop-blur-sm",
        emphasized
          ? "border-primary/15 bg-background/80"
          : "border-border/60 bg-background/80"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-xl font-semibold tabular-nums leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}

export function MobileHoleHero({
  activeHole,
  totalHoles,
  par,
  yardage,
  onOpenHoleMap,
}: MobileHoleHeroProps) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-t-2xl bg-linear-to-br from-primary/8 via-primary/4 to-transparent px-5 py-4">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Current hole
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-5xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {activeHole}
            </span>
            <span className="text-base font-medium text-muted-foreground">
              of {totalHoles}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {yardage != null && <HoleStatPill label="Yds" value={yardage} />}
            <HoleStatPill label="Par" value={par} emphasized />
          </div>
        </div>
        {onOpenHoleMap && (
          <button
            type="button"
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              runWithGeolocationUserGesture(onOpenHoleMap);
            }}
            onClick={() => runWithGeolocationUserGesture(onOpenHoleMap)}
            className={cn(
              GPS_BUTTON_SIZE,
              "flex shrink-0 flex-col items-center justify-center rounded-full border-2 border-primary/25 bg-primary text-primary-foreground shadow-md ring-4 ring-primary/10 transition-transform active:scale-95"
            )}
            aria-label="Open GPS hole view"
          >
            <span className="text-sm font-bold tracking-wider">GPS</span>
          </button>
        )}
      </div>
    </div>
  );
}


type ChangeScoresOverlayProps = {
  onUnlock: () => void;
};

export function ChangeScoresOverlay({ onUnlock }: ChangeScoresOverlayProps) {
  return (
    <button
      type="button"
      onClick={onUnlock}
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[3px] animate-in fade-in duration-200"
      aria-label="Change scores for this hole"
    >
      <span className="rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-lg ring-1 ring-black/5 transition-transform active:scale-[0.98]">
        Change scores?
      </span>
    </button>
  );
}

type MobileRoundDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function MobileRoundDetailsSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: MobileRoundDetailsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl p-0">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted" />
        <SheetHeader className="border-b border-border/50 px-5 pb-4 pt-3 text-left">
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
          <SheetDescription className="text-sm">{subtitle}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
