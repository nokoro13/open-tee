"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ExternalLink, Plus, Search } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHandicapDisplay, validateHandicapInput } from "@/lib/handicap-strokes";
import { isOperationalEventStatus } from "@/lib/events";
import { useIsMobile } from "@/hooks/use-mobile";
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
  registrationUrl: string;
  previewHref: string;
  scoringStatus: "disabled" | "open" | "finalized";
  eventStatus: string;
};

export function RegistrationsList({
  eventId,
  registrations,
  registrationCount,
  maxPlayers,
  registrationUrl,
  previewHref,
  scoringStatus,
  eventStatus,
}: RegistrationsListProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [copied, setCopied] = useState(false);
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

  async function copyLink() {
    await navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="gap-4 border-b [.border-b]:pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>
              {registrationCount} of {maxPlayers} spots filled
            </CardDescription>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [-ms-overflow-style:none] scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            {canManageComps && (
              <Sheet open={compOpen} onOpenChange={setCompOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 shrink-0 touch-manipulation sm:h-7"
                    >
                      <Plus />
                      Comp player
                    </Button>
                  }
                />
                <SheetContent
                  side={isMobile === false ? "right" : "bottom"}
                  className={
                    isMobile !== false
                      ? "max-h-[90dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
                      : "w-full sm:max-w-md"
                  }
                >
                  <SheetHeader>
                    <SheetTitle>Comp a player</SheetTitle>
                    <SheetDescription>
                      Add a free entry without payment.
                    </SheetDescription>
                  </SheetHeader>
                  <form
                    onSubmit={handleCompSubmit}
                    className="flex flex-1 flex-col gap-4 px-4"
                  >
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
                            setCompForm({
                              ...compForm,
                              handicap: e.target.value,
                            })
                          }
                          disabled={compPending}
                          placeholder="12.4 or +3"
                          inputMode="decimal"
                        />
                      </Field>
                    </FieldGroup>
                    {compError && (
                      <p className="text-sm text-destructive" role="alert">
                        {compError}
                      </p>
                    )}
                    <SheetFooter className="px-0">
                      <Button type="submit" disabled={compPending}>
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
                className="h-11 shrink-0 touch-manipulation sm:h-7"
                href={`/dashboard/events/${eventId}/export`}
              >
                <Download />
                Export
              </ButtonLink>
            )}
            <ButtonLink
              variant="outline"
              size="sm"
              className="h-11 shrink-0 touch-manipulation sm:h-7"
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Preview
            </ButtonLink>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            readOnly
            value={registrationUrl}
            className="h-11 min-w-0 font-mono text-xs sm:h-8 sm:text-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="size-11 shrink-0 touch-manipulation sm:size-8"
            onClick={copyLink}
            aria-label="Copy registration link"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players"
              className="h-11 pl-9 sm:h-8"
            />
          </div>
          <Select
            value={paymentFilter}
            onValueChange={(value) => {
              if (value) setPaymentFilter(value as PaymentFilter);
            }}
          >
            <SelectTrigger className="h-11 w-full touch-manipulation sm:h-8 sm:w-40">
              <SelectValue placeholder="Status" />
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

        {registrations.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No players yet. Copy the registration link above to get started.
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No players match your search.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border md:hidden">
              {filtered.map((reg) => (
                <li
                  key={reg.id}
                  className="flex items-center gap-3 py-3.5 touch-manipulation active:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{reg.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {reg.email}
                    </p>
                    {reg.handicap != null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        HCP {formatHandicapDisplay(reg.handicap)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge
                      variant={statusVariant[reg.paymentStatus]}
                      className="capitalize"
                    >
                      {reg.paymentStatus}
                    </Badge>
                    <EditRegistrationSheet
                      eventId={eventId}
                      registration={reg}
                      canComp={
                        canManageComps && reg.paymentStatus === "pending"
                      }
                      onComp={() => compRegistration(reg.id, eventId)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Handicap</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.name}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate sm:table-cell text-muted-foreground">
                      {reg.email}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {reg.handicap
                        ? formatHandicapDisplay(reg.handicap)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[reg.paymentStatus]}
                        className="capitalize"
                      >
                        {reg.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <EditRegistrationSheet
                        eventId={eventId}
                        registration={reg}
                        canComp={
                          canManageComps && reg.paymentStatus === "pending"
                        }
                        onComp={() => compRegistration(reg.id, eventId)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
