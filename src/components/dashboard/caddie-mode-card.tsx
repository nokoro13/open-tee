"use client";

import { MapPin, Navigation } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CaddieModeCardProps = {
  eventSlug: string;
  externalCourseId: string | null;
  courseName: string;
  publishedMapAvailable: boolean;
  publishedMappedHoles: number;
  dataQuality: string | null;
};

export function CaddieModeCard({
  eventSlug,
  externalCourseId,
  courseName,
  publishedMapAvailable,
  publishedMappedHoles,
  dataQuality,
}: CaddieModeCardProps) {
  const isReady = publishedMapAvailable && publishedMappedHoles > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Navigation className="size-4" />
            Caddie Mode
          </CardTitle>
          <Badge variant={isReady ? "default" : "secondary"}>
            {isReady ? "Ready" : "Unavailable"}
          </Badge>
          {dataQuality && isReady && (
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
            Select a verified course when creating this event to enable Caddie
            Mode.
          </p>
        ) : isReady ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {publishedMappedHoles} holes mapped from the verified course
              dataset. Players see front / mid / back green distances, hole maps,
              and slope heatmaps while scoring.
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
        ) : (
          <p className="text-sm text-muted-foreground">
            This event&apos;s course is not published in the verified catalog
            yet. Onboard and publish the course under Verified courses to
            enable Caddie Mode.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
