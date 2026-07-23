import { Building2 } from "lucide-react";

import { CoursePlanCard } from "@/components/dashboard/course-plan-card";
import { OrganizationSettingsForm } from "@/components/dashboard/organization-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrganization } from "@/lib/auth";

type OrganizationSettingsPageProps = {
  searchParams: Promise<{
    subscribed?: string;
    subscribe_canceled?: string;
  }>;
};

export default async function OrganizationSettingsPage({
  searchParams,
}: OrganizationSettingsPageProps) {
  const org = await requireOrganization();
  const { subscribed, subscribe_canceled } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Organization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Manage your organization profile and billing.
        </p>
      </div>

      <CoursePlanCard
        organization={org}
        subscribed={subscribed === "1"}
        subscribeCanceled={subscribe_canceled === "1"}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            Organization settings
          </CardTitle>
          <CardDescription>
            This is separate from your personal account name in Clerk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationSettingsForm organization={org} />
        </CardContent>
      </Card>
    </div>
  );
}
