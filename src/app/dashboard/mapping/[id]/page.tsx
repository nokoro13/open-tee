import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MappingReviewForm } from "@/components/dashboard/mapping-review-form";
import { ButtonLink } from "@/components/ui/button-link";
import { getMappingRequestForOrg } from "@/lib/golf-courses";
import { requireOrganization } from "@/lib/auth";
import { parseCoordinate } from "@/lib/green-distance";
import { fetchOsmGolfFeaturesNear } from "@/lib/overpass-golf";

type MappingReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MappingReviewPage({ params }: MappingReviewPageProps) {
  const { id } = await params;
  const org = await requireOrganization();
  const request = await getMappingRequestForOrg(id, org.id);

  if (!request) {
    notFound();
  }

  const holeNumbers = Array.from(
    new Set([
      ...request.course.holeFeatures.map((feature) => feature.holeNumber),
      ...request.course.greenTargets.map((target) => target.holeNumber),
    ])
  ).sort((a, b) => a - b);

  const holes = (holeNumbers.length > 0
    ? holeNumbers
    : Array.from({ length: 18 }, (_, index) => index + 1)
  ).map((holeNumber) => {
    const targets = request.course.greenTargets.filter(
      (target) => target.holeNumber === holeNumber
    );
    const front = targets.find((target) => target.targetType === "front");
    const middle = targets.find((target) => target.targetType === "middle");
    const back = targets.find((target) => target.targetType === "back");
    const hasGreen = request.course.holeFeatures.some(
      (feature) =>
        feature.holeNumber === holeNumber && feature.featureType === "green"
    );

    return {
      holeNumber,
      front: front
        ? `${parseCoordinate(front.latitude)?.toFixed(5)}, ${parseCoordinate(front.longitude)?.toFixed(5)}`
        : null,
      middle: middle
        ? `${parseCoordinate(middle.latitude)?.toFixed(5)}, ${parseCoordinate(middle.longitude)?.toFixed(5)}`
        : null,
      back: back
        ? `${parseCoordinate(back.latitude)?.toFixed(5)}, ${parseCoordinate(back.longitude)?.toFixed(5)}`
        : null,
      hasGreen,
    };
  });

  let osmGreenCount = 0;
  const lat = parseCoordinate(request.course.latitude);
  const lng = parseCoordinate(request.course.longitude);
  if (lat != null && lng != null) {
    try {
      const features = await fetchOsmGolfFeaturesNear(lat, lng);
      osmGreenCount = features.filter((feature) => feature.featureType === "green").length;
    } catch {
      osmGreenCount = 0;
    }
  }

  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        href="/dashboard/mapping"
        className="-ml-2 w-fit"
      >
        <ArrowLeft />
        Back to mapping queue
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Review course map
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{request.event.name}</p>
      </div>

      <MappingReviewForm
        key={`${request.id}:${request.course.mappedHoleCount}:${request.status}`}
        requestId={request.id}
        courseName={request.courseName}
        status={request.status}
        holes={holes}
        courseLatitude={request.course.latitude}
        courseLongitude={request.course.longitude}
        osmGreenCount={osmGreenCount}
      />
    </div>
  );
}
