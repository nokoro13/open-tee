const STORAGE_PREFIX = "opentee-scoring-code";

export function saveScoringCode(slug: string, code: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${STORAGE_PREFIX}:${slug}`, code.trim().toUpperCase());
}

export function getScoringCode(slug: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}:${slug}`);
}

export function getScorePageHref(slug: string, code?: string | null): string {
  const base = `/e/${slug}/score`;
  if (!code?.trim()) return base;
  return `${base}?code=${encodeURIComponent(code.trim().toUpperCase())}`;
}
