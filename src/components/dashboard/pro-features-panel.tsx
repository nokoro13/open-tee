"use client";

import { useState, useTransition } from "react";

import { updateProSettings } from "@/actions/pro-features";
import { updateRegistrationWindow } from "@/actions/events";
import { RegistrationWindowFields } from "@/components/dashboard/registration-window-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Event } from "@/db/schema";
import { registrationWindowValuesFromEvent } from "@/lib/registration-window";

type ProFeaturesPanelProps = {
  event: Event;
};

export function ProFeaturesPanel({ event }: ProFeaturesPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    waitlistEnabled: event.waitlistEnabled,
    groupRegistrationEnabled: event.groupRegistrationEnabled,
    smsRemindersEnabled: event.smsRemindersEnabled,
  });
  const [registrationWindow, setRegistrationWindow] = useState(() =>
    registrationWindowValuesFromEvent({
      registrationOpens: event.registrationOpens,
      registrationCloses: event.registrationCloses,
    })
  );

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

      if (event.status === "published") {
        const windowResult = await updateRegistrationWindow(
          event.id,
          registrationWindow
        );

        if (!windowResult.success) {
          setError(windowResult.error);
          return;
        }
      }

      setMessage("Settings saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration features</CardTitle>
        <CardDescription>
          Registration window, waitlist, group signup, and SMS reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-border/70 p-4">
            <input
              type="checkbox"
              checked={form.waitlistEnabled}
              onChange={(e) =>
                setForm({ ...form, waitlistEnabled: e.target.checked })
              }
            />
            <span className="text-sm">Enable waitlist when sold out</span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-border/70 p-4">
            <input
              type="checkbox"
              checked={form.groupRegistrationEnabled}
              onChange={(e) =>
                setForm({
                  ...form,
                  groupRegistrationEnabled: e.target.checked,
                })
              }
            />
            <span className="text-sm">Allow group registration</span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-border/70 p-4">
            <input
              type="checkbox"
              checked={form.smsRemindersEnabled}
              onChange={(e) =>
                setForm({ ...form, smsRemindersEnabled: e.target.checked })
              }
            />
            <span className="text-sm">Send SMS reminders (24h before)</span>
          </label>
        </div>

        {event.status === "published" && (
          <div className="border-t border-border/70 pt-5">
            <RegistrationWindowFields
              opensAt={event.registrationOpens}
              closesAt={event.registrationCloses}
              draftValues={registrationWindow}
              onDraftChange={setRegistrationWindow}
              editable
              disabled={isPending}
            />
          </div>
        )}

        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
