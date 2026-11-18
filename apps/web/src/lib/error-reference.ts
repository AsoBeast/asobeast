const OPAQUE_DIGEST = /^[0-9a-z]{4,40}$/i;

export function errorReference(error: { digest?: string }): string | null {
  const digest = error.digest?.trim();
  return digest && OPAQUE_DIGEST.test(digest) ? digest : null;
}
