import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations, type Organization } from "@/db/schema";
import { activatePendingCourseAccessForUser } from "@/lib/course-access";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export async function getOrganizationForUser(
  userId: string
): Promise<Organization | undefined> {
  return getDb().query.organizations.findFirst({
    where: eq(organizations.ownerClerkId, userId),
  });
}

export async function requireOrganization(): Promise<Organization> {
  const userId = await requireUserId();
  await activatePendingCourseAccessForUser(userId);

  const existing = await getOrganizationForUser(userId);

  if (existing) {
    return existing;
  }

  const user = await currentUser();
  const name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}'s Organization`
      : user?.firstName
        ? `${user.firstName}'s Organization`
        : "My Organization";

  const [created] = await getDb()
    .insert(organizations)
    .values({
      name,
      ownerClerkId: userId,
      contactEmail: user?.emailAddresses[0]?.emailAddress ?? null,
    })
    .returning();

  return created;
}
