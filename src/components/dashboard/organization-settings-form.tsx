"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateOrganization } from "@/actions/organization";
import type { Organization } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type OrganizationSettingsFormProps = {
  organization: Organization;
};

export function OrganizationSettingsForm({
  organization,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState({
    name: organization.name,
    contactEmail: organization.contactEmail ?? "",
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateOrganization(values);

      if (!result.success) {
        setError(result.error ?? "Could not save organization settings.");
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
          <Input
            id="org-name"
            name="name"
            value={values.name}
            onChange={(event) => {
              setSaved(false);
              setValues((current) => ({
                ...current,
                name: event.target.value,
              }));
            }}
            placeholder="Pine Valley Golf Club"
            disabled={isPending}
            required
            maxLength={100}
            autoComplete="organization"
          />
          <FieldDescription>
            Shown on your dashboard and public event pages.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="org-contact-email">Contact email</FieldLabel>
          <Input
            id="org-contact-email"
            name="contactEmail"
            type="email"
            value={values.contactEmail}
            onChange={(event) => {
              setSaved(false);
              setValues((current) => ({
                ...current,
                contactEmail: event.target.value,
              }));
            }}
            placeholder="tournaments@example.com"
            disabled={isPending}
            autoComplete="email"
          />
          <FieldDescription>
            Used for publish receipts and tournament notifications.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <p className="text-sm text-muted-foreground" role="status">
          Organization settings saved.
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full sm:w-auto"
      >
        {isPending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
