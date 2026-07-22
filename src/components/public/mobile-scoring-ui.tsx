"use client";

import { LocateFixed, LocateOff, Map, Waves } from "lucide-react";
import { ChevronUp } from "lucide-react";

import type { LiveDistanceStatus } from "@/hooks/use-live-distances";
import { requestGeolocationFromUserGesture, runWithGeolocationUserGesture } from "@/lib/geolocation-controller";
import type { MatchRunningScore, RunningScore } from "@/lib/score-entry-utils";
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

function firstName(label: string): string {
  return label.split(" ")[0] ?? label;
}

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

const AVATAR_TONES = [
  "bg-primary/15 text-primary",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
];

type MobileContextBarProps = {
  allowGroupSwitch: boolean;
  selectedGroupId: string;
  selectedGroup: ScoreEntryGroup | undefined;
  groups: ScoreEntryGroup[];
  isPending: boolean;
  onGroupChange: (groupId: string) => void;
  matchRunningScore: MatchRunningScore | null;
  runningScores: RunningScore[];
  completedHoles: number;
  totalHoles: number;
  onOpenDetails: () => void;
};

export function MobileContextBar({
  allowGroupSwitch,
  selectedGroupId,
  selectedGroup,
  groups,
  isPending,
  onGroupChange,
  matchRunningScore,
  runningScores,
  completedHoles,
  totalHoles,
  onOpenDetails,
}: MobileContextBarProps) {
  const statusLine = matchRunningScore
    ? matchRunningScore.status
    : `${completedHoles} of ${totalHoles} holes`;

  const statsLine = matchRunningScore
    ? `${firstName(matchRunningScore.playerA.label)} ${matchRunningScore.playerATotal ?? "—"} · ${firstName(matchRunningScore.playerB.label)} ${matchRunningScore.playerBTotal ?? "—"}`
    : runningScores.length === 1
      ? `Total ${runningScores[0].total ?? "—"} · thru ${runningScores[0].thru}`
      : runningScores
          .map((r) => `${firstName(r.label)} ${r.total ?? "—"}`)
          .join(" · ");

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        {allowGroupSwitch ? (
          <Select
            value={selectedGroupId}
            disabled={isPending}
            onValueChange={(value) => value && onGroupChange(value)}
          >
            <SelectTrigger className="h-8 w-full border-0 bg-transparent px-0 text-base font-semibold shadow-none">
              <SelectValue>{selectedGroup?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-base font-semibold leading-tight text-foreground">
            {selectedGroup?.label}
          </p>
        )}
        <p className="mt-0.5 text-sm text-muted-foreground">{statsLine}</p>
      </div>
      <button
        type="button"
        onClick={onOpenDetails}
        className="flex shrink-0 flex-col items-end rounded-xl px-2 py-1 transition-colors active:bg-muted/60"
        aria-label="View round details"
      >
        <p className="text-sm font-semibold text-primary">{statusLine}</p>
        <span className="mt-0.5 flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
          Details
          <ChevronUp className="size-3.5" />
        </span>
      </button>
    </div>
  );
}

type MobileHoleHeroProps = {
  activeHole: number;
  totalHoles: number;
  par: number;
  yardage?: number | null;
  onOpenHoleMap?: () => void;
  onOpenGreenHeatmap?: () => void;
  hasHeatmap?: boolean;
  isAtGreen?: boolean;
  liveDistanceStatus?: LiveDistanceStatus;
};

export function LiveLocationButton({
  status,
}: {
  status: LiveDistanceStatus;
}) {
  if (status === "hidden") return null;

  const isActive = status === "live" || status === "at-green";
  const Icon = status === "denied" || status === "unavailable" ? LocateOff : LocateFixed;

  const ariaLabel =
    status === "prompt"
      ? "Enable location for live yardage"
      : status === "locating"
        ? "Getting location"
        : status === "denied"
          ? "Location blocked. Tap to try again"
          : status === "unavailable"
            ? "Location unavailable. Tap to retry"
            : "Live yardage enabled";

  const className = cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors",
    isActive && "border-primary/50 bg-primary/15 text-primary",
    status === "locating" &&
      "border-border/70 bg-background/80 text-muted-foreground animate-pulse",
    status === "prompt" &&
      "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
    (status === "denied" || status === "unavailable") &&
      "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
  );

  if (isActive) {
    return (
      <span
        className={className}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <LocateFixed className="size-3.5" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        requestGeolocationFromUserGesture();
      }}
      onClick={() => requestGeolocationFromUserGesture()}
      className={className}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function MobileHoleHero({
  activeHole,
  totalHoles,
  par,
  yardage,
  onOpenHoleMap,
  onOpenGreenHeatmap,
  hasHeatmap = false,
  isAtGreen = false,
  liveDistanceStatus = "hidden",
}: MobileHoleHeroProps) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-t-2xl bg-linear-to-br from-primary/8 via-primary/4 to-transparent px-5 py-4">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5" />
      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Current hole
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {activeHole}
            </span>
            <span className="pb-1 text-base font-medium text-muted-foreground">
              of {totalHoles}
            </span>
          </div>
          {(onOpenHoleMap ||
            (onOpenGreenHeatmap && hasHeatmap) ||
            liveDistanceStatus !== "hidden") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onOpenHoleMap && (
                <button
                  type="button"
                  onPointerDown={(event) => {
                    if (event.pointerType === "mouse" && event.button !== 0) return;
                    runWithGeolocationUserGesture(onOpenHoleMap);
                  }}
                  onClick={() => runWithGeolocationUserGesture(onOpenHoleMap)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm"
                >
                  <Map className="size-3.5" />
                  Hole view
                </button>
              )}
              {onOpenGreenHeatmap && hasHeatmap && (
                <button
                  type="button"
                  onClick={onOpenGreenHeatmap}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
                    isAtGreen
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/70 bg-background/80 text-foreground"
                  )}
                >
                  <Waves className="size-3.5" />
                  {isAtGreen ? "Read putt" : "Putting read"}
                </button>
              )}
              {liveDistanceStatus !== "hidden" && (
                <LiveLocationButton status={liveDistanceStatus} />
              )}
            </div>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          {yardage != null && (
            <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 text-center shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Yds
              </p>
              <p className="font-heading text-2xl font-semibold tabular-nums leading-none text-foreground">
                {yardage}
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-primary/15 bg-background/80 px-4 py-2.5 text-center shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Par
            </p>
            <p className="font-heading text-3xl font-semibold tabular-nums leading-none text-foreground">
              {par}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type MobilePlayerAvatarProps = {
  name: string;
  index: number;
};

export function MobilePlayerAvatar({ name, index }: MobilePlayerAvatarProps) {
  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        AVATAR_TONES[index % AVATAR_TONES.length]
      )}
      aria-hidden
    >
      {playerInitials(name)}
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
