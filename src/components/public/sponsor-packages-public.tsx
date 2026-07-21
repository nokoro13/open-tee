"use client";

import { useState, useTransition } from "react";

import { purchaseSponsorPackage } from "@/actions/sponsors";
import { formatFee } from "@/lib/events";
import type { SponsorPackage } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SponsorPackagesPublicProps = {
  slug: string;
  packages: SponsorPackage[];
};

export function SponsorPackagesPublic({
  slug,
  packages,
}: SponsorPackagesPublicProps) {
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
  });

  function handlePurchase(packageId: string) {
    setError(null);
    startTransition(async () => {
      const result = await purchaseSponsorPackage(slug, packageId, form);
      if ("success" in result && !result.success) {
        setError(result.error);
      }
    });
  }

  if (packages.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Sponsor this event</CardTitle>
        <CardDescription>
          Support the outing and get visibility with players and spectators.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {packages.map((pkg) => (
            <li
              key={pkg.id}
              className="rounded-xl border border-border/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{pkg.name}</p>
                  {pkg.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pkg.description}
                    </p>
                  )}
                </div>
                <span className="text-sm font-medium">{formatFee(pkg.priceCents)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  setActivePackageId(
                    activePackageId === pkg.id ? null : pkg.id
                  )
                }
              >
                {activePackageId === pkg.id ? "Cancel" : "Select package"}
              </Button>
            </li>
          ))}
        </ul>

        {activePackageId && (
          <div className="rounded-xl border border-border/70 p-4 space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Company name</FieldLabel>
                <Input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  required
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel>Contact name</FieldLabel>
                <Input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                  required
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel>Contact email</FieldLabel>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                  required
                  disabled={isPending}
                />
              </Field>
            </FieldGroup>
            {error && <FieldError>{error}</FieldError>}
            <Button
              disabled={isPending}
              onClick={() => handlePurchase(activePackageId)}
            >
              {isPending ? "Processing..." : "Purchase sponsorship"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
