"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { events, organizations } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export type OrganizationSettingsInput = {
  name: string;
  contactEmail: string;
};

function parseOrganizationInput(
  input: OrganizationSettingsInput
): OrganizationSettingsInput | ActionResult {
  const name = input.name.trim();
  if (!name) {
    return { success: false, error: "Organization name is required." };
  }
  if (name.length > 100) {
    return {
      success: false,
      error: "Organization name must be 100 characters or fewer.",
    };
  }

  const contactEmail = input.contactEmail.trim();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { success: false, error: "Enter a valid contact email." };
  }

  return { name, contactEmail };
}

export async function updateOrganization(
  input: OrganizationSettingsInput
): Promise<ActionResult> {
  const org = await requireOrganization();
  const parsed = parseOrganizationInput(input);
  if ("success" in parsed) {
    return parsed;
  }

  await getDb()
    .update(organizations)
    .set({
      name: parsed.name,
      contactEmail: parsed.contactEmail || null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  const publishedEvents = await getDb().query.events.findMany({
    where: eq(events.orgId, org.id),
    columns: { slug: true, status: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  for (const event of publishedEvents) {
    if (event.status === "published") {
      revalidatePath(`/e/${event.slug}`);
    }
  }

  return { success: true };
}
