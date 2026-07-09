"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, Navigation, Sparkles } from "lucide-react";

import { requestCourseMapping } from "@/actions/course-mapping";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CaddieModeCardProps = {
  eventId: string;
  eventSlug: string;
  externalCourseId: string | null;
  courseName: string;
  publishedMapAvailable: boolean;
  publishedMappedHoles: number;
  dataQuality: string | null;
  latestRequest: {
    id: string;
    status: "pending" | "draft_ready" | "published" | "rejected";
    mappedHoleCount: number;
  } | null;
};

function statusLabel(
  publishedMapAvailable: boolean,
  request: CaddieModeCardProps["latestRequest"]
) {
  if (publishedMapAvailable) return "Ready";
  if (!request) return "Unavailable";
  if (request.status === "pending") return "Queued";
  if (request.status === "draft_ready") return "Review draft";
  if (request.status === "published") return "Ready";
  return "Unavailable";
}

export function CaddieModeCard({
  eventId,
  eventSlug,
  externalCourseId,
  courseName,
  publishedMapAvailable,
  publishedMappedHoles,
  dataQuality,
  latestRequest,
}: CaddieModeCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestCourseMapping(eventId);
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.requestId) {
        router.push(`/dashboard/mapping/${result.requestId}`);
      } else {
        router.refresh();
      }
    });
  }

  const status = statusLabel(publishedMapAvailable, latestRequest);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Navigation className="size-4" />
            Caddie Mode
          </CardTitle>
          <Badge variant={publishedMapAvailable ? "default" : "secondary"}>
            {status}
          </Badge>
          {dataQuality && publishedMapAvailable && (
            <Badge variant="outline">{dataQuality.replace("_", " ")}</Badge>
          )}
        </div>
        <CardDescription>
          Live GPS distances, hole maps, and green slope heatmaps for{" "}
          <span className="font-medium text-foreground">{courseName}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!externalCourseId ? (
          <p className="text-sm text-muted-foreground">
            Link this event to a course from search to enable GPS mapping.
          </p>
        ) : publishedMapAvailable ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {publishedMappedHoles} holes mapped. Players see front / mid / back
              green distances, hole maps, and slope heatmaps while scoring.
            </p>
            <ButtonLink
              href={`/e/${eventSlug}/score`}
              variant="outline"
              size="sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin />
              Preview scoring screen
            </ButtonLink>
          </div>
        ) : latestRequest?.status === "draft_ready" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              OSM draft ready with {latestRequest.mappedHoleCount} holes. Review
              and publish to enable Caddie Mode.
            </p>
            <ButtonLink href={`/dashboard/mapping/${latestRequest.id}`} size="sm">
              <Sparkles />
              Review mapping draft
            </ButtonLink>
          </div>
        ) : latestRequest?.status === "pending" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mapping request is queued. Open review to re-seed or publish.
            </p>
            <ButtonLink href={`/dashboard/mapping/${latestRequest.id}`} size="sm">
              Open mapping queue
            </ButtonLink>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Request a course map. We seed from OpenStreetMap, compute green
              targets, and generate slope heatmaps on publish.
            </p>
            <Button onClick={handleRequest} disabled={isPending} size="sm">
              <Sparkles />
              {isPending ? "Requesting…" : "Request course mapping"}
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
