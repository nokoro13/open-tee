import { auth } from "@clerk/nextjs/server";

function platformAdminIds(): string[] {
  const raw = process.env.PLATFORM_ADMIN_USER_IDS ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isPlatformAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return platformAdminIds().includes(userId);
}

export async function requirePlatformAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId || !isPlatformAdmin(userId)) {
    throw new Error("Unauthorized");
  }
  return userId;
}
