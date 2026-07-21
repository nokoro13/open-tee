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
    <Card>
      <CardHeader>
        <CardTitle>Flights</CardTitle>
        <CardDescription>
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
                className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
              >
                <span className="font-medium">{flight.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(flight.id)}
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
          />
          <Button disabled={isPending} onClick={handleCreate}>
            Add flight
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
