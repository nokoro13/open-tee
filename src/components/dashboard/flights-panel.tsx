"use client";

import { useState, useTransition } from "react";

import { createFlight, deleteFlight } from "@/actions/flights";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Flight } from "@/db/schema";

type FlightsPanelProps = {
  eventId: string;
  flights: Flight[];
};

export function FlightsPanel({ eventId, flights }: FlightsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createFlight(eventId, name);
      if (result.success) {
        setName("");
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(flightId: string) {
    startTransition(async () => {
      await deleteFlight(flightId, eventId);
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Flights</CardTitle>
        <CardDescription className="text-pretty">
          Create flights for segmented leaderboards and pairings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {flights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flights yet.</p>
        ) : (
          <ul className="space-y-2">
            {flights.map((flight) => (
              <li
                key={flight.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5"
              >
                <span className="min-w-0 truncate font-medium">{flight.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(flight.id)}
                  className="shrink-0"
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Championship Flight"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 text-base sm:text-sm"
          />
          <Button
            disabled={isPending}
            onClick={handleCreate}
            className="h-11 w-full sm:w-auto"
          >
            Add flight
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
