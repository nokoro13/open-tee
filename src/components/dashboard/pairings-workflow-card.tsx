"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Lock, Unlock } from "lucide-react";

import {
  finalizePairings,
  reopenPairings,
} from "@/actions/event-workflow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EventWorkflowSnapshot } from "@/lib/event-workflow";

type PairingsWorkflowCardProps = {
  eventId: string;
  workflow: EventWorkflowSnapshot;
  registrationCount: number;
};

export function PairingsWorkflowCard({
  eventId,
  workflow,
  registrationCount,
}: PairingsWorkflowCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pairingsStep = workflow.steps.find((s) => s.id === "pairings");
  const registrationStep = workflow.steps.find((s) => s.id === "registration");
  const isDone = pairingsStep?.isComplete ?? false;
  const registrationOpen = !(registrationStep?.isComplete ?? false);

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

  if (registrationCount === 0 && !isDone) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Pairings phase</CardTitle>
          <CardDescription>
            Add at least one player on the Players tab, then assign them to groups
            here.
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
            <Lock className="size-5 text-muted-foreground" />
          )}
          Pairings phase
        </CardTitle>
        <CardDescription>
          {isDone
            ? "Pairings are locked. Print scorecards next."
            : registrationOpen
              ? "Build groups while registration stays open. New signups will appear as unassigned players."
              : "Assign every player to a group that matches your event format."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isDone && registrationOpen && (
          <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
            Online signup can stay open while you pair. Close registration on the
            Players tab when your field is set, then lock pairings here.
          </div>
        )}

        {!isDone && workflow.pairingsIssues.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
            <p className="font-medium text-amber-950 dark:text-amber-100">
              Fix these before finalizing
            </p>
            <ul className="mt-1 list-disc pl-4 text-amber-950 dark:text-amber-100">
              {workflow.pairingsIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isDone ? (
            <Button
              type="button"
              className="h-11"
              disabled={isPending || !workflow.canFinalizePairings}
              onClick={() => setDialogOpen(true)}
            >
              <Lock />
              {isPending ? "Finalizing..." : "Finalize pairings"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={() => runAction(() => reopenPairings(eventId))}
            >
              <Unlock />
              Reopen pairings
            </Button>
          )}
        </div>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalize pairings?</AlertDialogTitle>
              <AlertDialogDescription>
                Group assignments will be locked so you can print scorecards.
                Reopen pairings if you need to make changes before scoring starts.
                {registrationOpen &&
                  " Registration is still open — new signups will need groups before you can finalize again."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() => {
                  setDialogOpen(false);
                  runAction(() => finalizePairings(eventId));
                }}
              >
                Finalize pairings
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
