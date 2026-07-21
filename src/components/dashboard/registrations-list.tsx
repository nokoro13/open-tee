"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";

import {
  addCompRegistration,
  compRegistration,
  type RegistrationInput,
} from "@/actions/registrations";
import type { Registration } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatHandicapDisplay, validateHandicapInput } from "@/lib/handicap-strokes";
import { isOperationalEventStatus } from "@/lib/events";
import { EditRegistrationSheet } from "@/components/dashboard/edit-registration-sheet";

const statusVariant: Record<
  Registration["paymentStatus"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  comped: "secondary",
  pending: "outline",
  refunded: "destructive",
};

type PaymentFilter = "all" | Registration["paymentStatus"];

type RegistrationsListProps = {
  eventId: string;
  registrations: Registration[];
  registrationCount: number;
  maxPlayers: number;
  scoringStatus: "disabled" | "open" | "finalized";
  eventStatus: string;
};

export function RegistrationsList({
  eventId,
  registrations,
  registrationCount,
  maxPlayers,
  scoringStatus,
  eventStatus,
}: RegistrationsListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [compOpen, setCompOpen] = useState(false);
  const [compPending, startCompTransition] = useTransition();
  const [compError, setCompError] = useState<string | null>(null);
  const [compForm, setCompForm] = useState<RegistrationInput>({
    name: "",
    email: "",
    handicap: "",
  });

  const canManageComps =
    isOperationalEventStatus(eventStatus) && scoringStatus !== "finalized";

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return registrations.filter((reg) => {
      if (paymentFilter !== "all" && reg.paymentStatus !== paymentFilter) {
        return false;
      }

      if (!normalizedQuery) return true;

      return (
        reg.name.toLowerCase().includes(normalizedQuery) ||
        reg.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [paymentFilter, query, registrations]);

  function handleCompSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCompError(null);

    const handicapResult = validateHandicapInput(compForm.handicap);
    if (!handicapResult.valid) {
      setCompError(handicapResult.error);
      return;
    }

    startCompTransition(async () => {
      const result = await addCompRegistration(eventId, {
        ...compForm,
        handicap: handicapResult.value ?? undefined,
      });

      if (!result.success) {
        setCompError(result.error);
        return;
      }

      setCompForm({ name: "", email: "", handicap: "" });
      setCompOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Registrations</CardTitle>
          <CardDescription>
            {registrationCount} of {maxPlayers} spots filled
            {eventStatus === "published" && scoringStatus === "disabled" && (
              <>
                {" "}
                · Online signup is open (
                <a
                  href="?tab=settings"
                  className="text-primary hover:underline"
                >
                  close in Settings
                </a>
                )
              </>
            )}
            {eventStatus === "closed" && scoringStatus === "disabled" && (
              <> · Online signup is closed</>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageComps && (
            <Sheet open={compOpen} onOpenChange={setCompOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Plus />
                    Comp player
                  </Button>
                }
              />
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Comp a player</SheetTitle>
                  <SheetDescription>
                    Add a free entry without payment. They&apos;ll receive a
                    confirmation email.
                  </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleCompSubmit} className="flex flex-1 flex-col gap-4 px-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="comp-name">Full name</FieldLabel>
                      <Input
                        id="comp-name"
                        value={compForm.name}
                        onChange={(e) =>
                          setCompForm({ ...compForm, name: e.target.value })
                        }
                        required
                        disabled={compPending}
                        autoComplete="name"
                        className="h-11 text-base sm:text-sm"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="comp-email">Email</FieldLabel>
                      <Input
                        id="comp-email"
                        type="email"
                        value={compForm.email}
                        onChange={(e) =>
                          setCompForm({ ...compForm, email: e.target.value })
                        }
                        required
                        disabled={compPending}
                        autoComplete="email"
                        className="h-11 text-base sm:text-sm"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="comp-handicap">
                        Handicap (optional)
                      </FieldLabel>
                      <Input
                        id="comp-handicap"
                        value={compForm.handicap}
                        onChange={(e) =>
                          setCompForm({ ...compForm, handicap: e.target.value })
                        }
                        disabled={compPending}
                        placeholder="12.4 or +3"
                        inputMode="decimal"
                        className="h-11 text-base sm:text-sm"
                      />
                    </Field>
                  </FieldGroup>
                  {compError && (
                    <p className="text-sm text-destructive" role="alert">
                      {compError}
                    </p>
                  )}
                  <SheetFooter className="px-0">
                    <Button
                      type="submit"
                      disabled={compPending}
                      className="h-11 w-full"
                    >
                      {compPending ? "Adding..." : "Add comp entry"}
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          )}
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {registrations.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className="h-11 pl-9 text-base sm:text-sm"
              />
            </div>
            <Select
              value={paymentFilter}
              onValueChange={(value) => {
                if (value) setPaymentFilter(value as PaymentFilter);
              }}
            >
              <SelectTrigger className="h-11 w-full sm:w-44">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="comped">Comped</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registrations yet. Share your registration link to get players
            signed up.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registrations match your search.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((reg) => (
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
                  <EditRegistrationSheet
                    eventId={eventId}
                    registration={reg}
                    canComp={
                      canManageComps && reg.paymentStatus === "pending"
                    }
                    onComp={() => compRegistration(reg.id, eventId)}
                  />
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
