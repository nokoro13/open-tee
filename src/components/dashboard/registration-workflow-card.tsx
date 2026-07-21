"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Lock, Unlock } from "lucide-react";

import {
  finalizeRegistration,
  reopenRegistrationWorkflow,
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

type RegistrationWorkflowCardProps = {
  eventId: string;
  workflow: EventWorkflowSnapshot;
  registrationCount: number;
};

export function RegistrationWorkflowCard({
  eventId,
  workflow,
  registrationCount,
}: RegistrationWorkflowCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const registrationStep = workflow.steps.find((s) => s.id === "registration");
  const isDone = registrationStep?.isComplete ?? false;

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
    <Card className="rounded-2xl border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {isDone ? (
            <CheckCircle2 className="size-5 text-primary" />
          ) : (
            <Lock className="size-5 text-muted-foreground" />
          )}
          Registration phase
        </CardTitle>
        <CardDescription>
          {isDone
            ? "Registration is closed. You can still add comps from the list below if needed."
            : `${registrationCount} player${registrationCount === 1 ? "" : "s"} registered. Build pairings anytime on the Pairings tab, then finalize registration when your field is set.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isDone && workflow.autoFinalizeReasons.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">Ready to finalize</p>
            <ul className="mt-1 list-disc pl-4">
              {workflow.autoFinalizeReasons.map((reason) => (
                <li key={reason}>{reason}</li>
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
            <>
              <Button
                type="button"
                className="h-11"
                disabled={isPending || !workflow.canFinalizeRegistration}
                onClick={() => setDialogOpen(true)}
              >
                <Lock />
                {isPending ? "Finalizing..." : "Finalize registration"}
              </Button>
              {!workflow.canFinalizeRegistration && registrationCount === 0 && (
                <p className="w-full text-sm text-muted-foreground">
                  Add at least one registration before finalizing.
                </p>
              )}
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={() => runAction(() => reopenRegistrationWorkflow(eventId))}
            >
              <Unlock />
              Reopen registration
            </Button>
          )}
        </div>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalize registration?</AlertDialogTitle>
              <AlertDialogDescription>
                Public registration will close. You can keep building pairings on
                the Pairings tab before or after this step. Reopen registration
                later if pairings are not finalized yet.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() => {
                  setDialogOpen(false);
                  runAction(() => finalizeRegistration(eventId));
                }}
              >
                Finalize registration
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
