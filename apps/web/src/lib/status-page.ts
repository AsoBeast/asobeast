const ALLOWED_PROTOCOLS = ["http:", "https:"];

export function statusPageUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
