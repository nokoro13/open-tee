"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  registerForEvent,
  type RegistrationInput,
} from "@/actions/registrations";
import { validateHandicapInput } from "@/lib/handicap-strokes";
import {
  REFUND_POLICY_DETAILS,
  REFUND_POLICY_SUMMARY,
} from "@/lib/refund-policy";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type RegistrationFormProps = {
  slug: string;
  entryFeeCents: number;
  spotsLeft: number;
  soldOut: boolean;
  registrationClosed: boolean;
  demoMode?: boolean;
};

export function RegistrationForm({
  slug,
  entryFeeCents,
  spotsLeft,
  soldOut,
  registrationClosed,
  demoMode = false,
}: RegistrationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RegistrationInput>({
    name: "",
    email: "",
    handicap: "",
  });

  const disabled = soldOut || registrationClosed || isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (demoMode) return;
    setError(null);

    const handicapResult = validateHandicapInput(form.handicap);
    if (!handicapResult.valid) {
      setError(handicapResult.error);
      return;
    }

    startTransition(async () => {
      const result = await registerForEvent(slug, {
        ...form,
        handicap: handicapResult.value ?? undefined,
      });
      if ("success" in result && !result.success) {
        setError(result.error);
      }
    });
  }

  if (soldOut) {
    return (
      <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        This event is sold out. Check back later for cancellations.
      </p>
    );
  }

  if (registrationClosed) {
    return (
      <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Registration is closed for this event.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reg-name">Full name</FieldLabel>
          <Input
            id="reg-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jordan Smith"
            className="h-11 text-base sm:text-sm"
            required
            disabled={disabled}
            autoComplete="name"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="reg-email">Email</FieldLabel>
          <Input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@email.com"
            className="h-11 text-base sm:text-sm"
            required
            disabled={disabled}
            autoComplete="email"
          />
          <FieldDescription>
            Confirmation and event updates will be sent here.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="reg-handicap">Handicap (optional)</FieldLabel>
          <Input
            id="reg-handicap"
            value={form.handicap}
            onChange={(e) => setForm({ ...form, handicap: e.target.value })}
            placeholder="12.4 or +3"
            className="h-11 text-base sm:text-sm"
            disabled={disabled}
            inputMode="decimal"
          />
          <FieldDescription>
            Regular handicaps: enter the number only (e.g. 12). Plus handicaps
            (better than scratch): use +3.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error && <FieldError>{error}</FieldError>}

      <div className="space-y-2">
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={disabled}
        >
          {isPending
            ? "Processing..."
            : entryFeeCents > 0
              ? `Register & pay`
              : "Register for free"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} remaining
          {entryFeeCents > 0 && " · Secure payment via Stripe"}
        </p>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By registering, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
        <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            Refund policy
          </summary>
          <p className="mt-2 leading-relaxed">{REFUND_POLICY_SUMMARY}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {REFUND_POLICY_DETAILS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </div>
    </form>
  );
}
