"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import {
  updateRegistration,
  type UpdateRegistrationInput,
} from "@/actions/registrations";
import type { Registration } from "@/db/schema";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type EditRegistrationSheetProps = {
  eventId: string;
  registration: Registration;
};

export function EditRegistrationSheet({
  eventId,
  registration,
}: EditRegistrationSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateRegistrationInput>({
    registrationId: registration.id,
    eventId,
    name: registration.name,
    email: registration.email,
    handicap: registration.handicap ?? "",
  });

  function resetForm() {
    setForm({
      registrationId: registration.id,
      eventId,
      name: registration.name,
      email: registration.email,
      handicap: registration.handicap ?? "",
    });
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const handicapResult = validateHandicapInput(form.handicap);
    if (!handicapResult.valid) {
      setError(handicapResult.error);
      return;
    }

    startTransition(async () => {
      const result = await updateRegistration({
        ...form,
        handicap: handicapResult.value ?? undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label={`Edit ${registration.name}`}
          />
        }
      >
        <Pencil className="size-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit registration</SheetTitle>
          <SheetDescription>
            Update player details if they signed up with incorrect information.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`edit-name-${registration.id}`}>
                Full name
              </FieldLabel>
              <Input
                id={`edit-name-${registration.id}`}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                disabled={isPending}
                autoComplete="name"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`edit-email-${registration.id}`}>
                Email
              </FieldLabel>
              <Input
                id={`edit-email-${registration.id}`}
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                disabled={isPending}
                autoComplete="email"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`edit-handicap-${registration.id}`}>
                Handicap
              </FieldLabel>
              <Input
                id={`edit-handicap-${registration.id}`}
                value={form.handicap}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    handicap: event.target.value,
                  }))
                }
                placeholder="12.4 or +3"
                disabled={isPending}
                inputMode="decimal"
              />
              <FieldDescription>
                Leave blank if unknown. Use +3 for plus handicaps (better than
                scratch).
              </FieldDescription>
            </Field>
          </FieldGroup>

          {error && <FieldError>{error}</FieldError>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
