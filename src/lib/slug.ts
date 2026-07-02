export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateEventSlug(name: string): string {
  const base = slugify(name) || "event";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
