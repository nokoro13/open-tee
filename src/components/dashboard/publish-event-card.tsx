"use client";

import { useTransition } from "react";
import { Rocket } from "lucide-react";

import { startPublishCheckout } from "@/actions/publish";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PublishEventCardProps = {
  eventId: string;
  eventName: string;
  platformFeeCents?: number;
};

export function PublishEventCard({
  eventId,
  eventName,
  platformFeeCents = 4900,
}: PublishEventCardProps) {
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    startTransition(async () => {
      await startPublishCheckout(eventId);
    });
  }

  const feeDisplay = `$${(platformFeeCents / 100).toFixed(0)}`;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Ready to go live?</CardTitle>
        <CardDescription>
          Publish &quot;{eventName}&quot; to open registration. Pay the Starter
          platform fee ({feeDisplay}/event) to activate your public registration
          page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="lg"
          className="h-11 w-full sm:w-auto"
          disabled={isPending}
          onClick={handlePublish}
        >
          <Rocket />
          {isPending ? "Redirecting to checkout..." : `Publish event — ${feeDisplay}`}
        </Button>
      </CardContent>
    </Card>
  );
}
