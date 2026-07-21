"use client";

import { useState, useTransition } from "react";
import Image from "next/image";

import { updateEventBranding } from "@/actions/pro-features";
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

type EventBrandingPanelProps = {
  event: Event;
};

export function EventBrandingPanel({ event }: EventBrandingPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    primaryColor: event.primaryColor ?? "",
    accentColor: event.accentColor ?? "",
    logoUrl: event.logoUrl ?? "",
    coverImageUrl: event.coverImageUrl ?? "",
  });

  async function uploadImage(kind: "logo" | "cover", file: File) {
    setError(null);
    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`/api/events/${event.id}/branding/${kind}`, {
      method: "POST",
      body,
    });

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setError(payload.error ?? "Upload failed.");
      return;
    }

    setForm((current) => ({
      ...current,
      [kind === "logo" ? "logoUrl" : "coverImageUrl"]: payload.url!,
    }));
  }

  function handleSave() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateEventBranding(event.id, form);
      if (result.success) {
        setMessage("Branding saved.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom branding</CardTitle>
        <CardDescription>
          Logo, cover image, and colors on your public registration page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary color</Label>
            <Input
              id="primary-color"
              placeholder="#1a5c3a"
              value={form.primaryColor}
              onChange={(e) =>
                setForm({ ...form, primaryColor: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent-color">Accent color</Label>
            <Input
              id="accent-color"
              placeholder="#c9a227"
              value={form.accentColor}
              onChange={(e) =>
                setForm({ ...form, accentColor: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Logo</Label>
            {form.logoUrl && (
              <Image
                src={form.logoUrl}
                alt="Event logo"
                width={120}
                height={120}
                className="rounded-lg border border-border object-contain"
              />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage("logo", file);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Cover image</Label>
            {form.coverImageUrl && (
              <Image
                src={form.coverImageUrl}
                alt="Event cover"
                width={240}
                height={120}
                className="h-24 w-full rounded-lg border border-border object-cover"
              />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage("cover", file);
              }}
            />
          </div>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving..." : "Save branding"}
        </Button>
      </CardContent>
    </Card>
  );
}
