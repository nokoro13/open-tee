"use client";

import { useState, useTransition } from "react";

import {
  registerGroupForEvent,
  type GroupPlayerInput,
} from "@/actions/registrations";
import { validateHandicapInput } from "@/lib/handicap-strokes";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type GroupRegistrationFormProps = {
  slug: string;
  maxGroupSize: number;
  entryFeeCents: number;
  spotsLeft: number;
};

function emptyPlayer(): GroupPlayerInput {
  return { name: "", email: "", handicap: "" };
}

export function GroupRegistrationForm({
  slug,
  maxGroupSize,
  entryFeeCents,
  spotsLeft,
}: GroupRegistrationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leaderName, setLeaderName] = useState("");
  const [leaderEmail, setLeaderEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [players, setPlayers] = useState<GroupPlayerInput[]>([
    emptyPlayer(),
    emptyPlayer(),
  ]);

  function updatePlayer(index: number, patch: Partial<GroupPlayerInput>) {
    setPlayers((current) =>
      current.map((player, i) => (i === index ? { ...player, ...patch } : player))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const player of players) {
      const handicapResult = validateHandicapInput(player.handicap);
      if (!handicapResult.valid) {
        setError(handicapResult.error);
        return;
      }
    }

    startTransition(async () => {
      const result = await registerGroupForEvent(slug, {
        leaderName,
        leaderEmail,
        phone,
        smsOptIn,
        players: players.map((player) => {
          const handicapResult = validateHandicapInput(player.handicap);
          return {
            ...player,
            handicap: handicapResult.valid
              ? (handicapResult.value ?? undefined)
              : undefined,
          };
        }),
      });

      if ("success" in result && !result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldGroup>
        <Field>
          <FieldLabel>Group contact name</FieldLabel>
          <Input
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
            required
            disabled={isPending}
          />
        </Field>
        <Field>
          <FieldLabel>Group contact email</FieldLabel>
          <Input
            type="email"
            value={leaderEmail}
            onChange={(e) => setLeaderEmail(e.target.value)}
            required
            disabled={isPending}
          />
          <FieldDescription>
            Payment confirmation goes to this address.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="space-y-4">
        {players.map((player, index) => (
          <div
            key={index}
            className="rounded-xl border border-border/70 p-4 space-y-3"
          >
            <p className="text-sm font-medium">Player {index + 1}</p>
            <Input
              placeholder="Full name"
              value={player.name}
              onChange={(e) => updatePlayer(index, { name: e.target.value })}
              required
              disabled={isPending}
            />
            <Input
              type="email"
              placeholder="Email"
              value={player.email}
              onChange={(e) => updatePlayer(index, { email: e.target.value })}
              required
              disabled={isPending}
            />
            <Input
              placeholder="Handicap (optional)"
              value={player.handicap}
              onChange={(e) => updatePlayer(index, { handicap: e.target.value })}
              disabled={isPending}
            />
          </div>
        ))}
      </div>

      {players.length < maxGroupSize && players.length < spotsLeft && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setPlayers([...players, emptyPlayer()])}
          disabled={isPending}
        >
          Add player
        </Button>
      )}

      <Field>
        <FieldLabel htmlFor="group-phone">Phone (optional)</FieldLabel>
        <Input
          id="group-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isPending}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={smsOptIn}
          onChange={(e) => setSmsOptIn(e.target.checked)}
          disabled={isPending}
        />
        Text me event reminders
      </label>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" size="lg" className="h-12 w-full" disabled={isPending}>
        {isPending
          ? "Processing..."
          : entryFeeCents > 0
            ? `Register group & pay`
            : "Register group"}
      </Button>
    </form>
  );
}
