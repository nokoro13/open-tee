import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PayoutInfoCard() {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Entry fee payouts</CardTitle>
        <CardDescription>
          How player payments work at launch.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-border/70 bg-muted/10 p-4 sm:p-5 text-sm text-muted-foreground space-y-3">
          <p>
            Player entry fees are collected securely through Stripe Checkout when
            someone registers. For Phase 1, payments are processed through
            OpenRound&apos;s Stripe account.
          </p>
          <p>
            Organizers receive payouts manually after the event. Stripe Connect
            for automatic club payouts is planned for a future release.
          </p>
          <p>
            Refunds for paid players are handled by the organizer through the
            Stripe dashboard unless you arrange another process with your players.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
