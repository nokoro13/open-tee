import { ArrowLeft } from "lucide-react";

import { EventForm } from "@/components/dashboard/event-form";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to events
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          New event
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Set up a draft tournament. Registration and payments come in Sprint 2.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            You can edit this anytime while the event is in draft.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm />
        </CardContent>
      </Card>
    </div>
  );
}
