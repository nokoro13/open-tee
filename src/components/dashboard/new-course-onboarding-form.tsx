"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCourseOnboarding } from "@/actions/course-onboarding";
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

export function NewCourseOnboardingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [holeCount, setHoleCount] = useState<"9" | "18">("18");

  return (
    <form
      className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createCourseOnboarding({
            name,
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
      <Field>
        <FieldLabel htmlFor="newCourseState">State</FieldLabel>
        <Input
          id="newCourseState"
          value={state}
          onChange={(event) => setState(event.target.value)}
        />
      </Field>
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

      {error && (
        <p className="text-sm text-destructive sm:col-span-2">{error}</p>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Start course onboarding"}
        </Button>
      </div>
    </form>
  );
}
