export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Required for AdvancedMarkerElement. Use DEMO_MAP_ID in dev or set in Google Cloud Console. */
export const GOOGLE_MAPS_MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

/** mapId and client-side styles are mutually exclusive — satellite imagery keeps POI minimal. */
export const GOLF_SATELLITE_MAP_PROPS = {
  mapId: GOOGLE_MAPS_MAP_ID,
  mapTypeId: "satellite" as const,
  /** Required for programmatic map rotation (tee at bottom, green at top). */
  renderingType: "VECTOR" as const,
  tiltInteractionEnabled: false,
  headingInteractionEnabled: false,
};
