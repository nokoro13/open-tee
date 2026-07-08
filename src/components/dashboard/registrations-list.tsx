import type { Registration } from "@/db/schema";
import { Download, Lock } from "lucide-react";

import { EditRegistrationSheet } from "@/components/dashboard/edit-registration-sheet";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isEventSetupLocked,
  type EventScoringStatus,
} from "@/lib/event-setup-lock";
import { formatHandicapDisplay } from "@/lib/handicap-strokes";

const statusVariant: Record<
  Registration["paymentStatus"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  comped: "secondary",
  pending: "outline",
  refunded: "destructive",
};

type RegistrationsListProps = {
  eventId: string;
  registrations: Registration[];
  registrationCount: number;
  maxPlayers: number;
  scoringStatus: EventScoringStatus;
};

export function RegistrationsList({
  eventId,
  registrations,
  registrationCount,
  maxPlayers,
  scoringStatus,
}: RegistrationsListProps) {
  const registrationLocked = isEventSetupLocked(scoringStatus);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Registrations</CardTitle>
          <CardDescription>
            {registrationCount} of {maxPlayers} spots filled
            {registrationLocked ? " · New sign-ups are closed" : ""}
          </CardDescription>
        </div>
        {registrations.length > 0 && (
          <ButtonLink
            variant="outline"
            size="sm"
            href={`/dashboard/events/${eventId}/export`}
          >
            <Download />
            Export CSV
          </ButtonLink>
        )}
      </CardHeader>
      <CardContent>
        {registrationLocked && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>
              New registrations are closed. You can still edit existing player
              details.
            </span>
          </div>
        )}
        {registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registrations yet. Share your registration link to get players
            signed up.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {registrations.map((reg) => (
              <li
                key={reg.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{reg.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {reg.email}
                  </p>
                  {reg.handicap && (
                    <p className="text-xs text-muted-foreground">
                      Handicap: {formatHandicapDisplay(reg.handicap)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <EditRegistrationSheet eventId={eventId} registration={reg} />
                  <Badge variant={statusVariant[reg.paymentStatus]} className="capitalize">
                    {reg.paymentStatus}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
