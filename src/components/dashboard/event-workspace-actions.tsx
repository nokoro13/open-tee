"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ExternalLink,
  Lock,
  Mail,
  MoreHorizontal,
  Play,
  Printer,
} from "lucide-react";

import { useEventDetailTab } from "@/components/dashboard/event-detail-view";
import {
  emailPlayersScoringLinks,
  finalizeScoring,
  openScoring,
} from "@/actions/scoring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Event } from "@/db/schema";
import type { SetupStep } from "@/lib/event-dashboard";
import type { EventWorkflowSnapshot } from "@/lib/event-workflow";
import { getScorePageHref } from "@/lib/scoring-code-storage";
import type { GroupScoringProgress } from "@/lib/scoring";

type EventWorkspaceActionsProps = {
  event: Pick<Event, "id" | "slug" | "scoringStatus" | "scoringCode">;
  canPrintScorecards: boolean;
  printScorecardsHref: string;
  workflow: EventWorkflowSnapshot | null;
  groupScoringProgress: GroupScoringProgress | null;
  nextStep: SetupStep | null;
  isDraft: boolean;
};

export function EventWorkspaceActions({
  event,
  canPrintScorecards,
  printScorecardsHref,
  workflow,
  groupScoringProgress,
  nextStep,
  isDraft,
}: EventWorkspaceActionsProps) {
  const { setActiveTab } = useEventDetailTab();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openScoringDialogOpen, setOpenScoringDialogOpen] = useState(false);

  const canOpenScoring = workflow?.canOpenScoring ?? false;
  const pairingsIssues = workflow?.pairingsIssues ?? [];
  const canFinalize = groupScoringProgress?.allComplete ?? false;
  const marshalHref =
    event.scoringCode != null
      ? getScorePageHref(event.slug, event.scoringCode)
      : null;

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.success) router.refresh();
    });
  }

  function handleNextStep() {
    if (!nextStep) return;
    if (nextStep.href) {
      window.open(nextStep.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (nextStep.focusScoring) {
      setOpenScoringDialogOpen(true);
      return;
    }
    setActiveTab(nextStep.tab);
  }

  const actionButtonClassName =
    "h-8 shrink-0 touch-manipulation px-2.5 text-xs md:h-7 md:px-2.5 md:text-[0.8rem]";

  if (isDraft) {
    return nextStep ? (
      <Button
        type="button"
        size="sm"
        className={actionButtonClassName}
        onClick={handleNextStep}
      >
        {nextStep.label}
      </Button>
    ) : null;
  }

  const openScoringBtn = (
    <Button
      type="button"
      size="sm"
      className={actionButtonClassName}
      disabled={isPending || !canOpenScoring}
      onClick={() => setOpenScoringDialogOpen(true)}
    >
      <Play className="size-3.5 md:size-4" />
      <span className="hidden sm:inline">Open scoring</span>
      <span className="sm:hidden">Open</span>
    </Button>
  );

  const isPrintNextStep = nextStep?.href === printScorecardsHref;
  const showNextStep = nextStep && !isPrintNextStep;

  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 md:gap-2">
      {showNextStep && (
        <Button
          type="button"
          size="sm"
          className={actionButtonClassName}
          onClick={handleNextStep}
        >
          {nextStep.label}
        </Button>
      )}

      {canPrintScorecards && (
        <ButtonLink
          href={printScorecardsHref}
          variant={isPrintNextStep ? "default" : "outline"}
          size="sm"
          className={actionButtonClassName}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Print scorecards"
        >
          <Printer className="size-3.5 md:size-4" />
          <span className="hidden min-[360px]:inline lg:hidden">Print</span>
          <span className="hidden lg:inline">Print scorecards</span>
        </ButtonLink>
      )}

      {event.scoringStatus === "disabled" && workflow &&
        (canOpenScoring ? (
          openScoringBtn
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span>{openScoringBtn}</span>} />
            <TooltipContent className="max-w-xs">
              {pairingsIssues[0] ?? "Complete pairings before opening scoring."}
            </TooltipContent>
          </Tooltip>
        ))}

      {event.scoringStatus !== "disabled" && (
        <>
          <ButtonLink
            variant="outline"
            size="sm"
            className={actionButtonClassName}
            href={`/e/${event.slug}/leaderboard`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            Leaderboard
          </ButtonLink>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={actionButtonClassName}
                >
                  <MoreHorizontal />
                  More
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              {event.scoringStatus === "open" && (
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await emailPlayersScoringLinks(event.id);
                      router.refresh();
                    });
                  }}
                >
                  <Mail />
                  Email scoring links
                </DropdownMenuItem>
              )}
              {marshalHref && event.scoringStatus === "open" && (
                <DropdownMenuItem
                  render={
                    <a
                      href={marshalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Marshal scorer
                </DropdownMenuItem>
              )}
              {event.scoringCode && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    Marshal code: {event.scoringCode}
                  </DropdownMenuItem>
                </>
              )}
              {event.scoringStatus === "open" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending || !canFinalize}
                    onClick={() => runAction(() => finalizeScoring(event.id))}
                  >
                    <Lock />
                    Finalize results
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <AlertDialog
        open={openScoringDialogOpen}
        onOpenChange={setOpenScoringDialogOpen}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Play className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Open scoring for this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes public registration and locks pairings and the start
              schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                setOpenScoringDialogOpen(false);
                runAction(() => openScoring(event.id));
              }}
            >
              {isPending ? "Opening…" : "Open scoring"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
