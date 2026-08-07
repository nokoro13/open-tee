import {
  parseCourseCountry,
  resolveRegionCode,
  type CourseCountry,
} from "@/lib/course-location";
import { createGoogleCourseId } from "@/lib/google-course-id";

/** Ephemeral form values from Places Autocomplete — persist only after user confirms on save. */
export type CourseGooglePlacePrefill = {
  name: string;
  address: string;
  city: string;
  state: string;
  country: CourseCountry;
  latitude: number;
  longitude: number;
};

/** Only `externalCourseId` (Google place_id) may be kept long-term from Places. */
export type CourseGooglePlaceSelection = CourseGooglePlacePrefill & {
  externalCourseId: string;
};

type ParseGooglePlaceResult =
  | { ok: true; data: CourseGooglePlaceSelection }
  | { ok: false; error: string };

function addressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string
): google.maps.GeocoderAddressComponent | undefined {
  return components.find((component) => component.types.includes(type));
}

function supportedCountryCode(
  components: google.maps.GeocoderAddressComponent[]
): CourseCountry | null {
  const country = addressComponent(components, "country");
  const code = country?.short_name?.trim().toUpperCase();
  if (code === "US" || code === "CA") {
    return code;
  }
  return null;
}

function buildStreetAddress(
  components: google.maps.GeocoderAddressComponent[]
): string {
  const streetNumber = addressComponent(components, "street_number")?.long_name;
  const route = addressComponent(components, "route")?.long_name;
  const parts = [streetNumber, route].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return "";
}

function resolveCity(
  components: google.maps.GeocoderAddressComponent[]
): string {
  const locality =
    addressComponent(components, "locality")?.long_name ??
    addressComponent(components, "postal_town")?.long_name ??
    addressComponent(components, "sublocality")?.long_name ??
    addressComponent(components, "administrative_area_level_2")?.long_name;
  return locality?.trim() ?? "";
}

export function parseGooglePlaceForCourse(
  place: google.maps.places.PlaceResult
): ParseGooglePlaceResult {
  const placeId = place.place_id?.trim();
  const location = place.geometry?.location;

  if (!placeId) {
    return { ok: false, error: "Could not read the selected place." };
  }

  if (!location) {
    return {
      ok: false,
      error: "The selected place does not include map coordinates.",
    };
  }

  const components = place.address_components ?? [];
  const country = supportedCountryCode(components);

  if (!country) {
    return {
      ok: false,
      error: "Only courses in the United States or Canada are supported.",
    };
  }

  const regionRaw =
    addressComponent(components, "administrative_area_level_1")?.short_name ??
    addressComponent(components, "administrative_area_level_1")?.long_name ??
    "";
  const state = resolveRegionCode(country, regionRaw);
  const streetAddress = buildStreetAddress(components);
  const formattedAddress = place.formatted_address?.trim() ?? "";
  const address = streetAddress || formattedAddress;
  const name = place.name?.trim() || formattedAddress || "Golf course";

  return {
    ok: true,
    data: {
      name,
      address,
      city: resolveCity(components),
      state,
      country: parseCourseCountry(country),
      latitude: location.lat(),
      longitude: location.lng(),
      externalCourseId: createGoogleCourseId(placeId),
    },
  };
}
