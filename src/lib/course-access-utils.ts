import type { CourseAccess } from "@/db/schema";

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function courseAccessLabel(grant: CourseAccess): string {
  if (grant.status === "pending") {
    return grant.inviteEmail ?? "Pending invite";
  }
  return grant.inviteEmail ?? grant.clerkUserId ?? "Active editor";
}
