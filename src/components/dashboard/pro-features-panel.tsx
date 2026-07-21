"use client";

import { useState, useTransition } from "react";

import { updateProSettings } from "@/actions/pro-features";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Event } from "@/db/schema";

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
    maxGroupSize: event.maxGroupSize,
    smsRemindersEnabled: event.smsRemindersEnabled,
    earlyBirdFeeDollars:
      event.earlyBirdFeeCents != null
        ? String(event.earlyBirdFeeCents / 100)
        : "",
    earlyBirdEndsAt: event.earlyBirdEndsAt
      ? event.earlyBirdEndsAt.toISOString().slice(0, 16)
      : "",
  });

  function handleSave() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateProSettings(event.id, {
        waitlistEnabled: form.waitlistEnabled,
        groupRegistrationEnabled: form.groupRegistrationEnabled,
        maxGroupSize: form.maxGroupSize,
        smsRemindersEnabled: form.smsRemindersEnabled,
        earlyBirdFeeDollars: form.earlyBirdFeeDollars
          ? Number.parseFloat(form.earlyBirdFeeDollars)
          : null,
        earlyBirdEndsAt: form.earlyBirdEndsAt || null,
      });

      if (result.success) {
        setMessage("Pro settings saved.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pro registration features</CardTitle>
        <CardDescription>
          Waitlist, early-bird pricing, group signup, and SMS reminders.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max-group-size">Max group size</Label>
            <Input
              id="max-group-size"
              type="number"
              min={2}
              max={4}
              value={form.maxGroupSize}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxGroupSize: Number.parseInt(e.target.value, 10) || 4,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="early-bird-fee">Early bird fee ($)</Label>
            <Input
              id="early-bird-fee"
              inputMode="decimal"
              placeholder="Leave blank to disable"
              value={form.earlyBirdFeeDollars}
              onChange={(e) =>
                setForm({ ...form, earlyBirdFeeDollars: e.target.value })
              }
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="early-bird-ends">Early bird ends</Label>
            <Input
              id="early-bird-ends"
              type="datetime-local"
              value={form.earlyBirdEndsAt}
              onChange={(e) =>
                setForm({ ...form, earlyBirdEndsAt: e.target.value })
              }
            />
          </div>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving..." : "Save Pro settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
