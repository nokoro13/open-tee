"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCourseOnboarding } from "@/actions/course-onboarding";
import {
  CourseDuplicateWarning,
  useCourseDuplicateCheck,
} from "@/components/dashboard/course-duplicate-warning";
import { CourseRegionSelect, clearRegionIfInvalid } from "@/components/dashboard/course-region-select";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COURSE_COUNTRIES,
  parseCourseCountry,
  type CourseCountry,
} from "@/lib/course-location";

export function NewCourseOnboardingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [country, setCountry] = useState<CourseCountry>("US");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [holeCount, setHoleCount] = useState<"9" | "18">("18");

  const duplicateCheck = useCourseDuplicateCheck({
    name,
    city,
    state,
    country,
  });

  return (
    <form
      className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createCourseOnboarding({
            name,
            country,
            city,
            state,
            address,
            latitude: Number(latitude),
            longitude: Number(longitude),
            holeCount: holeCount === "9" ? 9 : 18,
          });
          if (!result.success) {
            setError(result.error ?? "Could not create course.");
            return;
          }
          if (!result.courseId) {
            setError("Could not create course.");
            return;
          }
          router.push(`/dashboard/courses/${result.courseId}/onboard`);
        });
      }}
    >
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="newCourseName">Course name</FieldLabel>
        <Input
          id="newCourseName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel>Country</FieldLabel>
        <Select
          value={country}
          onValueChange={(value) => {
            const nextCountry = parseCourseCountry(value);
            setCountry(nextCountry);
            setState((current) => clearRegionIfInvalid(nextCountry, current));
          }}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COURSE_COUNTRIES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="newCourseAddress">Address</FieldLabel>
        <Input
          id="newCourseAddress"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="newCourseCity">City</FieldLabel>
        <Input
          id="newCourseCity"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
      </Field>
      <CourseRegionSelect
        id="newCourseState"
        country={country}
        value={state}
        onChange={setState}
      />
      <Field>
        <FieldLabel htmlFor="newCourseLatitude">Latitude</FieldLabel>
        <Input
          id="newCourseLatitude"
          value={latitude}
          onChange={(event) => setLatitude(event.target.value)}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="newCourseLongitude">Longitude</FieldLabel>
        <Input
          id="newCourseLongitude"
          value={longitude}
          onChange={(event) => setLongitude(event.target.value)}
          required
        />
        <FieldDescription>
          Use Google Maps to find the course center coordinates.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Hole count</FieldLabel>
        <Select
          value={holeCount}
          onValueChange={(value) => {
            if (value === "9" || value === "18") setHoleCount(value);
          }}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9">9 holes</SelectItem>
            <SelectItem value="18">18 holes</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="sm:col-span-2">
        <CourseDuplicateWarning
          matches={duplicateCheck.matches}
          isChecking={duplicateCheck.isChecking}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive sm:col-span-2">{error}</p>
      )}

      <div className="sm:col-span-2">
        <Button
          type="submit"
          disabled={isPending || duplicateCheck.hasExactMatch}
        >
          {isPending ? "Creating..." : "Start course onboarding"}
        </Button>
      </div>
    </form>
  );
}
