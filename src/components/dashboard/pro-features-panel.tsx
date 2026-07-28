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
    <Card>
      <CardHeader>
        <CardTitle>Registration features</CardTitle>
        <CardDescription>
          Open or close registration, plus waitlist, group signup, and SMS
          reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {scoringStarted && event.status !== "draft" && event.status !== "archived" && (
          <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            Registration is locked while scoring is active.
          </div>
        )}

        <div className="space-y-3">
          {canToggleRegistration && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
              <div className="space-y-1">
                <Label htmlFor="registration-open" className="text-sm font-medium">
                  Registration open
                </Label>
                <p className="text-sm text-muted-foreground">
                  Turn off when your field is set. Scoring locks registration
                  automatically.
                </p>
              </div>
              <Switch
                id="registration-open"
                checked={registrationOpen}
                disabled={isPending}
                onCheckedChange={handleRegistrationToggle}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
            <div className="space-y-1">
              <Label htmlFor="waitlist-enabled" className="text-sm font-medium">
                Waitlist when sold out
              </Label>
              <p className="text-sm text-muted-foreground">
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
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
            <div className="space-y-1">
              <Label
                htmlFor="group-registration-enabled"
                className="text-sm font-medium"
              >
                Group registration
              </Label>
              <p className="text-sm text-muted-foreground">
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
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
            <div className="space-y-1">
              <Label htmlFor="sms-reminders-enabled" className="text-sm font-medium">
                SMS reminders
              </Label>
              <p className="text-sm text-muted-foreground">
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
            />
          </div>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
