"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Lock, Mail, Play, Trophy } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getScorePageHref } from "@/lib/scoring-code-storage";

type ScoringCardProps = {
  eventId: string;
  slug: string;
  scoringStatus: "disabled" | "open" | "finalized";
  scoringCode: string | null;
  appUrl: string;
};

const statusLabel = {
  disabled: "Not started",
  open: "Live",
  finalized: "Finalized",
} as const;

const statusVariant = {
  disabled: "secondary",
  open: "default",
  finalized: "outline",
} as const;

export function ScoringCard({
  eventId,
  slug,
  scoringStatus,
  scoringCode,
  appUrl,
}: ScoringCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openScoringDialogOpen, setOpenScoringDialogOpen] = useState(false);

  const marshalScoreUrl =
    scoringCode != null
      ? `${appUrl}${getScorePageHref(slug, scoringCode)}`
      : null;
  const leaderboardUrl = `${appUrl}/e/${slug}/leaderboard`;

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  function runEmailPlayers() {
    setError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const result = await emailPlayersScoringLinks(eventId);
      if (!result.success) {
        setError(result.error ?? "Could not email players.");
        return;
      }

      const parts = [
        `Emailed ${result.emailed} player${result.emailed === 1 ? "" : "s"}.`,
      ];
      if (result.failed > 0) {
        parts.push(
          `${result.failed} email${result.failed === 1 ? "" : "s"} could not be sent.`
        );
        if (result.warning) {
          parts.push(result.warning);
        }
      }
      if (result.skipped > 0) {
        parts.push(
          `${result.skipped} player${result.skipped === 1 ? "" : "s"} skipped (no scoring link or refunded).`
        );
      }
      setSuccessMessage(parts.join(" "));
    });
  }

  function confirmOpenScoring() {
    setOpenScoringDialogOpen(false);
    runAction(() => openScoring(eventId));
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4" />
            Live scoring
          </CardTitle>
          <CardDescription>
            Open scoring for tournament day. Email players their scorecard links
            or share each group&apos;s link from the Pairings section.
          </CardDescription>
        </div>
        <Badge variant={statusVariant[scoringStatus]}>{statusLabel[scoringStatus]}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="text-sm text-muted-foreground" role="status">
            {successMessage}
          </p>
        )}

        {scoringStatus === "disabled" && (
          <>
            <p className="text-sm text-muted-foreground">
              Opening scoring closes public registration and locks the start
              schedule and pairings.
            </p>
            <AlertDialog
              open={openScoringDialogOpen}
              onOpenChange={setOpenScoringDialogOpen}
            >
              <Button
                type="button"
                size="lg"
                className="h-11 w-full sm:w-auto"
                disabled={isPending}
                onClick={() => setOpenScoringDialogOpen(true)}
              >
                <Play />
                {isPending ? "Opening..." : "Open scoring"}
              </Button>
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <Play className="size-5" />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Open scoring for this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This closes public registration and locks the start schedule
                    and pairings. You can still enter scores and edit existing
                    player details.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    onClick={confirmOpenScoring}
                  >
                    {isPending ? "Opening..." : "Open scoring"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {scoringStatus !== "disabled" && (
          <>
            {scoringCode && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3">
                <p className="text-sm font-medium">Marshal code (organizers only)</p>
                <p className="font-mono text-2xl font-semibold tracking-widest">
                  {scoringCode}
                </p>
                <p className="text-xs text-muted-foreground">
                  For staff who need to enter scores for any group. Do not share
                  with players.
                </p>
                {marshalScoreUrl && scoringStatus === "open" && (
                  <ButtonLink
                    variant="outline"
                    size="sm"
                    href={getScorePageHref(slug, scoringCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Open marshal scorer
                  </ButtonLink>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <ButtonLink
                variant="outline"
                size="sm"
                href={`/e/${slug}/leaderboard`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                View leaderboard
              </ButtonLink>

              {scoringStatus === "open" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={runEmailPlayers}
                >
                  <Mail />
                  {isPending ? "Sending..." : "Email players"}
                </Button>
              )}
            </div>

            {scoringStatus === "open" && (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => runAction(() => finalizeScoring(eventId))}
              >
                <Lock />
                {isPending ? "Finalizing..." : "Finalize results"}
              </Button>
            )}

            {scoringStatus === "finalized" && (
              <p className="text-sm text-muted-foreground">
                Results are locked. Share the{" "}
                <a
                  href={leaderboardUrl}
                  className="text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  public leaderboard
                </a>{" "}
                with players and spectators.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
