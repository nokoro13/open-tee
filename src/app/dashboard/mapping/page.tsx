import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { getMappingRequestsForOrg } from "@/lib/golf-courses";
import { requireOrganization } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function MappingQueuePage() {
  const org = await requireOrganization();
  const requests = await getMappingRequestsForOrg(org.id);

  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to dashboard
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Course mapping
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review and publish OSM-seeded course maps for Caddie Mode.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No mapping requests yet. Open an event with a linked course and request
          Caddie Mode mapping.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/dashboard/mapping/${request.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">{request.courseName}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.event.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {request.course.mappedHoleCount} holes
                  </Badge>
                  <Badge
                    variant={
                      request.status === "published" ? "default" : "secondary"
                    }
                  >
                    {request.status.replace("_", " ")}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
