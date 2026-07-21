import "server-only";

import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { events } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { canUseProFeature } from "@/lib/platform-tier";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type BrandingImageKind = "logo" | "cover";

export async function uploadEventBrandingImage(
  eventId: string,
  kind: BrandingImageKind,
  file: File
): Promise<{ url: string } | { error: string; status: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return {
      error: "File storage is not configured. Add BLOB_READ_WRITE_TOKEN.",
      status: 503,
    };
  }

  const org = await requireOrganization();
  const event = await getDb().query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.orgId, org.id)),
  });

  if (!event) {
    return { error: "Event not found.", status: 404 };
  }

  if (!canUseProFeature(event, "custom_branding")) {
    return {
      error: "Custom branding requires a Pro event.",
      status: 403,
    };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Upload a valid image file.", status: 400 };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: "Image is too large. Try a smaller file (max 4 MB).",
      status: 413,
    };
  }

  const pathname = `events/${eventId}/${kind}-${Date.now()}.jpg`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type === "image/png" ? file.type : "image/jpeg",
  });

  const field = kind === "logo" ? "logoUrl" : "coverImageUrl";
  await getDb()
    .update(events)
    .set({
      [field]: blob.url,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  return { url: blob.url };
}
