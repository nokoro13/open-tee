import { Building2 } from "lucide-react";

import { OrganizationSettingsForm } from "@/components/dashboard/organization-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOrganization } from "@/lib/auth";

export default async function OrganizationSettingsPage() {
  const org = await requireOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Organization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Set the name players see on your public event pages.
        </p>
      </div>

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
