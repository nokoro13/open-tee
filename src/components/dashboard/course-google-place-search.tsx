"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_PLACES_LIBRARIES,
} from "@/lib/google-maps-config";
import {
  type CourseGooglePlaceSelection,
  parseGooglePlaceForCourse,
} from "@/lib/google-place-course";

type CourseGooglePlaceSearchFieldProps = {
  id?: string;
  onPlaceSelect: (selection: CourseGooglePlaceSelection) => void;
};

function CourseGooglePlaceSearchField({
  id = "courseGooglePlaceSearch",
  onPlaceSelect,
}: CourseGooglePlaceSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const placesLib = useMapsLibrary("places");
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      componentRestrictions: { country: ["us", "ca"] },
      fields: [
        "place_id",
        "name",
        "formatted_address",
        "address_components",
        "geometry",
      ],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const result = parseGooglePlaceForCourse(place);

      if (!result.ok) {
        setSearchError(result.error);
        return;
      }

      setSearchError(null);
      onPlaceSelectRef.current(result.data);
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [placesLib]);

  return (
    <Field className="sm:col-span-2">
      <FieldLabel htmlFor={id}>Find course on Google Maps</FieldLabel>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={id}
          type="search"
          placeholder="Search golf courses, e.g. Pebble Beach Golf Links"
          className="h-11 pl-9"
          autoComplete="off"
        />
      </div>
      <FieldDescription>
        Search to auto-fill the course name, address, and coordinates. You can
        still edit the fields below.
      </FieldDescription>
      {searchError && (
        <p className="text-sm text-destructive">{searchError}</p>
      )}
    </Field>
  );
}

type CourseGooglePlaceSearchProps = CourseGooglePlaceSearchFieldProps;

export function CourseGooglePlaceSearch(props: CourseGooglePlaceSearchProps) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Field className="sm:col-span-2">
        <FieldLabel>Find course on Google Maps</FieldLabel>
        <FieldDescription>
          Google Maps API key is not configured. Enter course details manually
          below.
        </FieldDescription>
      </Field>
    );
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={GOOGLE_MAPS_PLACES_LIBRARIES}
    >
      <CourseGooglePlaceSearchField {...props} />
    </APIProvider>
  );
}
