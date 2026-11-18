const OPAQUE_DIGEST = /^[0-9a-z]{4,40}$/i;

export function errorReference(error: { digest?: unknown }): string | null {
  if (typeof error.digest !== "string") return null;
  const digest = error.digest.trim();
  return OPAQUE_DIGEST.test(digest) ? digest : null;
}
