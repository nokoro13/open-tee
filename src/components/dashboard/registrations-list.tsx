import type { Registration } from "@/db/schema";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
};

export function RegistrationsList({
  eventId,
  registrations,
  registrationCount,
  maxPlayers,
}: RegistrationsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Registrations</CardTitle>
          <CardDescription>
            {registrationCount} of {maxPlayers} spots filled
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
        {registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registrations yet. Share your registration link to get players
            signed up.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {registrations.map((reg) => (
              <li key={reg.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{reg.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {reg.email}
                  </p>
                  {reg.handicap && (
                    <p className="text-xs text-muted-foreground">
                      Handicap: {reg.handicap}
                    </p>
                  )}
                </div>
                <Badge
                  variant={statusVariant[reg.paymentStatus]}
                  className="shrink-0 capitalize"
                >
                  {reg.paymentStatus}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
