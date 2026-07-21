"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Printer, Undo2 } from "lucide-react";

import {
  markScorecardsReady,
  undoScorecardsReady,
} from "@/actions/event-workflow";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EventWorkflowSnapshot } from "@/lib/event-workflow";

type ScorecardsWorkflowCardProps = {
  eventId: string;
  workflow: EventWorkflowSnapshot;
};

export function ScorecardsWorkflowCard({
  eventId,
  workflow,
}: ScorecardsWorkflowCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scorecardsStep = workflow.steps.find((s) => s.id === "scorecards");
  const pairingsStep = workflow.steps.find((s) => s.id === "pairings");
  const isDone = scorecardsStep?.isComplete ?? false;
  const pairingsDone = pairingsStep?.isComplete ?? false;

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

  if (!pairingsDone && !isDone) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Scorecards</CardTitle>
          <CardDescription>
            Finalize pairings before printing scorecards.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {isDone ? (
            <CheckCircle2 className="size-5 text-primary" />
          ) : (
            <Printer className="size-5 text-muted-foreground" />
          )}
          Scorecards
        </CardTitle>
        <CardDescription>
          {isDone
            ? "Scorecards are ready. Open scoring on tournament day."
            : "Print one scorecard per group, then confirm below."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <ButtonLink
            variant="outline"
            className="h-11"
            href={`/print/events/${eventId}/scorecards`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer />
            Print scorecards
          </ButtonLink>

          {!isDone ? (
            <Button
              type="button"
              className="h-11"
              disabled={isPending || !workflow.canMarkScorecardsReady}
              onClick={() => runAction(() => markScorecardsReady(eventId))}
            >
              {isPending ? "Saving..." : "Mark scorecards ready"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={() => runAction(() => undoScorecardsReady(eventId))}
            >
              <Undo2 />
              Undo ready status
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
