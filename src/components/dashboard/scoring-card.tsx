"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Lock, Play, Trophy } from "lucide-react";

import { finalizeScoring, openScoring } from "@/actions/scoring";
import { CopyRegistrationLink } from "@/components/dashboard/copy-registration-link";
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

  const scoreUrl =
    scoringCode != null
      ? `${appUrl}/e/${slug}/score?code=${scoringCode}`
      : `${appUrl}/e/${slug}/score`;
  const leaderboardUrl = `${appUrl}/e/${slug}/leaderboard`;

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
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
            Open scoring for tournament day. Share the scorer link with volunteers.
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

        {scoringStatus === "disabled" && (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full sm:w-auto"
            disabled={isPending}
            onClick={() => runAction(() => openScoring(eventId))}
          >
            <Play />
            {isPending ? "Opening..." : "Open scoring"}
          </Button>
        )}

        {scoringStatus !== "disabled" && (
          <>
            {scoringCode && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Scoring code</p>
                <p className="font-mono text-2xl font-semibold tracking-widest">
                  {scoringCode}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Scorer link</p>
              <CopyRegistrationLink url={scoreUrl} />
            </div>

            <div className="flex flex-wrap gap-2">
              <ButtonLink
                variant="outline"
                size="sm"
                href={`/e/${slug}/score${scoringCode ? `?code=${scoringCode}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                Open scorer page
              </ButtonLink>
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
