import { ApiError } from "@/lib/api";

const MAX_RETRIES = 3;
const MAX_DELAY_MS = 30_000;

function refusedRequest(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.envelope.statusCode >= 400 &&
    error.envelope.statusCode < 500
  );
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (refusedRequest(error)) return false;
  return failureCount < MAX_RETRIES;
}

export function retryDelayFor(failureCount: number, error: unknown): number {
  const retryAfterSeconds =
    error instanceof ApiError ? error.envelope.retryAfterSeconds : undefined;
  if (retryAfterSeconds !== undefined) return retryAfterSeconds * 1000;
  return Math.min(1000 * 2 ** failureCount, MAX_DELAY_MS);
}
