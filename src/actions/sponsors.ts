"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getEventById } from "@/actions/events";
import { getDb } from "@/db";
import { events, sponsorPackages, sponsorPurchases } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { canUseProFeature } from "@/lib/platform-tier";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type SponsorPackageInput = {
  name: string;
  description?: string;
  priceDollars: number;
  logoUrl?: string;
};

export async function createSponsorPackage(
  eventId: string,
  input: SponsorPackageInput
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  if (!canUseProFeature(event, "sponsor_packages")) {
    return { success: false, error: "Sponsor packages require a Pro event." };
  }

  if (!input.name.trim()) {
    return { success: false, error: "Package name is required." };
  }

  if (input.priceDollars < 0) {
    return { success: false, error: "Price cannot be negative." };
  }

  const existing = await getDb().query.sponsorPackages.findMany({
    where: eq(sponsorPackages.eventId, eventId),
  });

  const [created] = await getDb()
    .insert(sponsorPackages)
    .values({
      eventId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceCents: Math.round(input.priceDollars * 100),
      logoUrl: input.logoUrl?.trim() || null,
      sortOrder: existing.length,
    })
    .returning({ id: sponsorPackages.id });

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true, id: created.id };
}

export async function deleteSponsorPackage(
  packageId: string,
  eventId: string
): Promise<ActionResult> {
  const org = await requireOrganization();
  const event = await getEventById(eventId);

  if (!event || event.orgId !== org.id) {
    return { success: false, error: "Event not found." };
  }

  await getDb()
    .delete(sponsorPackages)
    .where(
      and(
        eq(sponsorPackages.id, packageId),
        eq(sponsorPackages.eventId, eventId)
      )
    );

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/e/${event.slug}`);
  return { success: true };
}

export async function getSponsorPackagesForEvent(eventId: string) {
  return getDb().query.sponsorPackages.findMany({
    where: and(
      eq(sponsorPackages.eventId, eventId),
      eq(sponsorPackages.isActive, true)
    ),
    orderBy: (table, { asc }) => [asc(table.sortOrder)],
  });
}

export async function getSponsorPackagesForDashboard(
  eventId: string,
  orgId: string
) {
  const event = await getEventById(eventId);
  if (!event || event.orgId !== orgId) return { packages: [], purchases: [] };

  const packages = await getDb().query.sponsorPackages.findMany({
    where: eq(sponsorPackages.eventId, eventId),
    orderBy: (table, { asc }) => [asc(table.sortOrder)],
  });

  const purchases = await getDb().query.sponsorPurchases.findMany({
    where: eq(sponsorPurchases.eventId, eventId),
    with: { package: true },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return { packages, purchases };
}

export type SponsorPurchaseInput = {
  companyName: string;
  contactName: string;
  contactEmail: string;
};

export async function purchaseSponsorPackage(
  slug: string,
  packageId: string,
  input: SponsorPurchaseInput
): Promise<ActionResult> {
  if (!input.companyName.trim() || !input.contactName.trim()) {
    return { success: false, error: "Company and contact name are required." };
  }
  if (!input.contactEmail.trim() || !input.contactEmail.includes("@")) {
    return { success: false, error: "A valid contact email is required." };
  }

  const event = await getDb().query.events.findFirst({
    where: and(eq(events.slug, slug), eq(events.status, "published")),
  });

  if (!event || !canUseProFeature(event, "sponsor_packages")) {
    return { success: false, error: "Sponsorship is not available." };
  }

  const pkg = await getDb().query.sponsorPackages.findFirst({
    where: and(
      eq(sponsorPackages.id, packageId),
      eq(sponsorPackages.eventId, event.id),
      eq(sponsorPackages.isActive, true)
    ),
  });

  if (!pkg) {
    return { success: false, error: "Sponsor package not found." };
  }

  if (pkg.priceCents === 0) {
    await getDb().insert(sponsorPurchases).values({
      eventId: event.id,
      packageId: pkg.id,
      companyName: input.companyName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      amountCents: 0,
      paymentStatus: "comped",
    });
    revalidatePath(`/dashboard/events/${event.id}`);
    revalidatePath(`/e/${slug}`);
    return { success: true };
  }

  const [purchase] = await getDb()
    .insert(sponsorPurchases)
    .values({
      eventId: event.id,
      packageId: pkg.id,
      companyName: input.companyName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      amountCents: pkg.priceCents,
      paymentStatus: "pending",
    })
    .returning({ id: sponsorPurchases.id });

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${event.name} — ${pkg.name}`,
            description: pkg.description ?? "Event sponsorship",
          },
          unit_amount: pkg.priceCents,
        },
        quantity: 1,
      },
    ],
    customer_email: input.contactEmail.trim().toLowerCase(),
    metadata: {
      type: "sponsor_purchase",
      purchaseId: purchase.id,
      eventId: event.id,
      packageId: pkg.id,
    },
    success_url: `${appUrl}/e/${slug}?sponsor=1`,
    cancel_url: `${appUrl}/e/${slug}?sponsor_canceled=1`,
  });

  if (!session.url) {
    return { success: false, error: "Could not start payment." };
  }

  await getDb()
    .update(sponsorPurchases)
    .set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(sponsorPurchases.id, purchase.id));

  redirect(session.url);
}

export async function handleSponsorPurchasePaid(
  purchaseId: string,
  eventId: string,
  sessionId: string,
  paymentIntentId: string | null
) {
  const purchase = await getDb().query.sponsorPurchases.findFirst({
    where: eq(sponsorPurchases.id, purchaseId),
  });

  if (!purchase || purchase.eventId !== eventId) return;
  if (purchase.paymentStatus === "paid") return;

  await getDb()
    .update(sponsorPurchases)
    .set({
      paymentStatus: "paid",
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(sponsorPurchases.id, purchaseId));
}
