const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isScorecardImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("data:image/") ||
    (trimmed.startsWith("https://") && trimmed.length > 8)
  );
}

export function isBlobScorecardImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}
