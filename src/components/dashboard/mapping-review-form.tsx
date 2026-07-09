"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";

import {
  publishCourseMapping,
  reseedCourseMappingDraft,
} from "@/actions/course-mapping";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

type HoleReview = {
  holeNumber: number;
  front: string | null;
  middle: string | null;
  back: string | null;
  hasGreen: boolean;
};

type MappingReviewFormProps = {
  requestId: string;
  courseName: string;
  status: "pending" | "draft_ready" | "published" | "rejected";
  holes: HoleReview[];
  courseLatitude: string | null;
  courseLongitude: string | null;
  osmGreenCount: number;
};

function mapsUrl(lat: string, lng: string) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function MappingReviewForm({
  requestId,
  courseName,
  status,
  holes,
  courseLatitude,
  courseLongitude,
  osmGreenCount,
}: MappingReviewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mappedCount = holes.filter((hole) => hole.middle).length;

  function runAction(
    action: () => Promise<{
      success: boolean;
      error?: string;
      seedMeta?: { assignedHoleCount: number; overpassGreenCount: number; overpassError: string | null };
    }>
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      if (result.seedMeta) {
        const { assignedHoleCount, overpassGreenCount, overpassError } = result.seedMeta;
        if (assignedHoleCount > 0) {
          setMessage(
            `Re-seeded ${assignedHoleCount} holes from ${overpassGreenCount} OSM greens.`
          );
        } else if (overpassError) {
          setError(`Seed failed: ${overpassError}`);
        } else {
          setError("No green data found. Check course coordinates and try again.");
        }
      } else {
        setMessage("Published. Caddie Mode is now live for this course.");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "published" ? "default" : "secondary"}>
          {status.replace("_", " ")}
        </Badge>
        <Badge variant="outline">
          {mappedCount} / {holes.length} holes with targets
        </Badge>
        {osmGreenCount > 0 && (
          <Badge variant="outline">{osmGreenCount} OSM greens nearby</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Review geo-seeded green targets for <strong>{courseName}</strong>. Front,
        middle, and back points are computed from OSM green polygons. Publish to
        generate elevation heatmaps and enable Caddie Mode.
      </p>

      {mappedCount === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          No holes mapped yet. Click <strong>Re-seed from OSM</strong> to import
          green data from OpenStreetMap.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || status === "published"}
          onClick={() => runAction(() => reseedCourseMappingDraft(requestId))}
        >
          <RefreshCw />
          Re-seed from OSM
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending || status === "published" || mappedCount === 0}
          onClick={() => runAction(() => publishCourseMapping(requestId))}
        >
          <Sparkles />
          Publish Caddie Mode
        </Button>
        {courseLatitude && courseLongitude && (
          <ButtonLink
            href={mapsUrl(courseLatitude, courseLongitude)}
            variant="ghost"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            View course on map
          </ButtonLink>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {message && <p className="text-sm text-primary">{message}</p>}

      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[720px] grid-cols-[56px_1fr_1fr_1fr_80px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Hole</span>
          <span>Front</span>
          <span>Middle</span>
          <span>Back</span>
          <span>Green</span>
        </div>
        {holes.map((hole) => (
          <div
            key={hole.holeNumber}
            className="grid min-w-[720px] grid-cols-[56px_1fr_1fr_1fr_80px] items-center gap-3 border-b px-4 py-3 last:border-b-0 text-xs font-mono"
          >
            <span className="font-medium font-sans">{hole.holeNumber}</span>
            <span className="truncate text-muted-foreground">
              {hole.front ?? "—"}
            </span>
            <span className="truncate text-muted-foreground">
              {hole.middle ?? "—"}
            </span>
            <span className="truncate text-muted-foreground">
              {hole.back ?? "—"}
            </span>
            <Badge variant={hole.hasGreen ? "default" : "outline"}>
              {hole.hasGreen ? "OSM" : "Missing"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
