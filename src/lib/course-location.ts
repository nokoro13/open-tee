export type CourseCountry = "US" | "CA";

export const COURSE_COUNTRIES: { value: CourseCountry; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

const CANADA_COUNTRY_VALUES = new Set(["CA", "CAN", "CANADA"]);
const USA_COUNTRY_VALUES = new Set(["US", "USA", "UNITED STATES"]);

export function parseCourseCountry(
  value: string | null | undefined
): CourseCountry {
  if (!value?.trim()) return "US";

  const normalized = value.trim().toUpperCase();
  if (CANADA_COUNTRY_VALUES.has(normalized)) return "CA";
  if (USA_COUNTRY_VALUES.has(normalized)) return "US";

  return "US";
}

export function resolveCourseLocation(
  country: string | null | undefined,
  region: string | null | undefined
): { country: CourseCountry; region: string } {
  const parsedCountry = parseCourseCountry(country);
  const regionForCountry = resolveRegionCode(parsedCountry, region);

  if (regionForCountry) {
    return { country: parsedCountry, region: regionForCountry };
  }

  const alternateCountry: CourseCountry = parsedCountry === "US" ? "CA" : "US";
  const regionForAlternate = resolveRegionCode(alternateCountry, region);
  if (regionForAlternate) {
    return { country: alternateCountry, region: regionForAlternate };
  }

  return { country: parsedCountry, region: "" };
}

export function regionLabel(country: CourseCountry): string {
  return country === "CA" ? "Province" : "State";
}

export const US_STATES: { value: string; label: string }[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export const CA_PROVINCES: { value: string; label: string }[] = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

export function regionOptions(country: CourseCountry): { value: string; label: string }[] {
  return country === "CA" ? CA_PROVINCES : US_STATES;
}

export function isValidRegionForCountry(
  country: CourseCountry,
  region: string | null | undefined
): boolean {
  if (!region?.trim()) return false;
  const code = region.trim().toUpperCase();
  return regionOptions(country).some((entry) => entry.value === code);
}

export function resolveRegionCode(
  country: CourseCountry,
  region: string | null | undefined
): string {
  if (!region?.trim()) return "";

  const options = regionOptions(country);
  const trimmed = region.trim();
  const upper = trimmed.toUpperCase();

  const byValue = options.find((entry) => entry.value === upper);
  if (byValue) return byValue.value;

  const lower = trimmed.toLowerCase();
  const byLabel = options.find((entry) => entry.label.toLowerCase() === lower);
  if (byLabel) return byLabel.value;

  return "";
}

export function normalizeCourseMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function formatCourseLocationLine(options: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
}): string {
  const country = parseCourseCountry(options.country);
  const locality = [options.city, options.state].filter(Boolean).join(", ");
  const parts = [options.address, locality].filter(Boolean);

  if (parts.length === 0) {
    return country === "CA" ? "Canada" : "United States";
  }

  const line = parts.join(", ");
  return country === "CA" ? `${line}, Canada` : line;
}
