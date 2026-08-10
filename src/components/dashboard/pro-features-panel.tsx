"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  closeEventRegistration,
  reopenEventRegistration,
} from "@/actions/events";
import { updateProSettings } from "@/actions/pro-features";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Event } from "@/db/schema";
import { isRegistrationOpen } from "@/lib/events";
import { eventWorkspaceSettingsSurfaceClassName } from "@/lib/event-workspace-layout";

type ProFeaturesPanelProps = {
  event: Event;
};

export function ProFeaturesPanel({ event }: ProFeaturesPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    waitlistEnabled: event.waitlistEnabled,
    groupRegistrationEnabled: event.groupRegistrationEnabled,
    smsRemindersEnabled: event.smsRemindersEnabled,
  });

  const scoringStarted =
    event.scoringStatus === "open" || event.scoringStatus === "finalized";
  const registrationOpen = isRegistrationOpen(event);
  const canToggleRegistration =
    !scoringStarted &&
    (event.status === "published" || event.status === "closed");

  function handleRegistrationToggle(checked: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = checked
        ? await reopenEventRegistration(event.id)
        : await closeEventRegistration(event.id);

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  function handleSave() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const proResult = await updateProSettings(event.id, {
        waitlistEnabled: form.waitlistEnabled,
        groupRegistrationEnabled: form.groupRegistrationEnabled,
        smsRemindersEnabled: form.smsRemindersEnabled,
      });

      if (!proResult.success) {
        setError(proResult.error);
        return;
      }

      setMessage("Settings saved.");
    });
  }

  return (
    <Card className={eventWorkspaceSettingsSurfaceClassName}>
      <CardHeader>
        <CardTitle>Registration features</CardTitle>
        <CardDescription className="text-pretty">
          Open or close registration, plus waitlist, group signup, and SMS
          reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {scoringStarted && event.status !== "draft" && event.status !== "archived" && (
          <div className="rounded-xl border border-border/70 bg-muted/10 px-3.5 py-3 text-sm text-pretty text-muted-foreground sm:px-4">
            Registration is locked while scoring is active.
          </div>
        )}

        <div className="space-y-3">
          {canToggleRegistration && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3.5 sm:items-center sm:gap-4 sm:p-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="registration-open" className="text-sm font-medium">
                  Registration open
                </Label>
                <p className="text-sm text-pretty text-muted-foreground">
                  Turn off when your field is set. Scoring locks registration
                  automatically.
                </p>
              </div>
              <Switch
                id="registration-open"
                checked={registrationOpen}
                disabled={isPending}
                onCheckedChange={handleRegistrationToggle}
                className="mt-0.5 shrink-0 sm:mt-0"
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3.5 sm:items-center sm:gap-4 sm:p-4">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="waitlist-enabled" className="text-sm font-medium">
                Waitlist when sold out
              </Label>
              <p className="text-sm text-pretty text-muted-foreground">
                Let players join a waitlist after the event fills up.
              </p>
            </div>
            <Switch
              id="waitlist-enabled"
              checked={form.waitlistEnabled}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setForm({ ...form, waitlistEnabled: checked })
              }
              className="mt-0.5 shrink-0 sm:mt-0"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3.5 sm:items-center sm:gap-4 sm:p-4">
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="group-registration-enabled"
                className="text-sm font-medium"
              >
                Group registration
              </Label>
              <p className="text-sm text-pretty text-muted-foreground">
                Allow one person to register multiple players at once.
              </p>
            </div>
            <Switch
              id="group-registration-enabled"
              checked={form.groupRegistrationEnabled}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setForm({ ...form, groupRegistrationEnabled: checked })
              }
              className="mt-0.5 shrink-0 sm:mt-0"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3.5 sm:items-center sm:gap-4 sm:p-4">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="sms-reminders-enabled" className="text-sm font-medium">
                SMS reminders
              </Label>
              <p className="text-sm text-pretty text-muted-foreground">
                Text registrants 24 hours before tee time.
              </p>
            </div>
            <Switch
              id="sms-reminders-enabled"
              checked={form.smsRemindersEnabled}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setForm({ ...form, smsRemindersEnabled: checked })
              }
              className="mt-0.5 shrink-0 sm:mt-0"
            />
          </div>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          disabled={isPending}
          onClick={handleSave}
          className="h-11 w-full sm:w-auto"
        >
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
