"use client";

import { useState, useTransition } from "react";

import {
  createSponsorPackage,
  deleteSponsorPackage,
} from "@/actions/sponsors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFee } from "@/lib/events";
import type { SponsorPackage, SponsorPurchase } from "@/db/schema";

type SponsorPackagesPanelProps = {
  eventId: string;
  packages: SponsorPackage[];
  purchases: (SponsorPurchase & { package: SponsorPackage })[];
};

export function SponsorPackagesPanel({
  eventId,
  packages,
  purchases,
}: SponsorPackagesPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    priceDollars: "",
  });

  const revenueCents = purchases
    .filter((purchase) => purchase.paymentStatus === "paid")
    .reduce((sum, purchase) => sum + purchase.amountCents, 0);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createSponsorPackage(eventId, {
        name: form.name,
        description: form.description,
        priceDollars: Number.parseFloat(form.priceDollars) || 0,
      });

      if (result.success) {
        setForm({ name: "", description: "", priceDollars: "" });
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(packageId: string) {
    startTransition(async () => {
      await deleteSponsorPackage(packageId, eventId);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sponsor packages</CardTitle>
          <CardDescription>
            Offer sponsorship tiers on your public event page. Revenue tracked:{" "}
            {formatFee(revenueCents)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sponsor packages yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {packages.map((pkg) => (
                <li
                  key={pkg.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-4"
                >
                  <div>
                    <p className="font-medium">{pkg.name}</p>
                    {pkg.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {pkg.description}
                      </p>
                    )}
                    <p className="mt-1 text-sm">{formatFee(pkg.priceCents)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDelete(pkg.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sponsor-name">Package name</Label>
              <Input
                id="sponsor-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sponsor-price">Price ($)</Label>
              <Input
                id="sponsor-price"
                inputMode="decimal"
                value={form.priceDollars}
                onChange={(e) =>
                  setForm({ ...form, priceDollars: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="sponsor-description">Description</Label>
              <Input
                id="sponsor-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button disabled={isPending} onClick={handleCreate}>
            Add sponsor package
          </Button>
        </CardContent>
      </Card>

      {purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sponsor purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {purchases.map((purchase) => (
                <li
                  key={purchase.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                >
                  <span>
                    {purchase.companyName} · {purchase.package.name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatFee(purchase.amountCents)} · {purchase.paymentStatus}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
