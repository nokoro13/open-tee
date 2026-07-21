"use client";

import { useState, useTransition } from "react";

import { joinWaitlist } from "@/actions/waitlist";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type WaitlistFormProps = {
  slug: string;
};

export function WaitlistForm({ slug }: WaitlistFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlist(slug, form);
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        You&apos;re on the waitlist. We&apos;ll email you if a spot opens up.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="waitlist-name">Full name</FieldLabel>
          <Input
            id="waitlist-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={isPending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="waitlist-email">Email</FieldLabel>
          <Input
            id="waitlist-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            disabled={isPending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="waitlist-phone">Phone (optional)</FieldLabel>
          <Input
            id="waitlist-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={isPending}
          />
        </Field>
      </FieldGroup>
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Joining..." : "Join waitlist"}
      </Button>
    </form>
  );
}
