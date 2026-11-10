import { StoreRequestError } from '../store-providers/errors';

export const INSPECTION_PENDING_TTL_MS = 10 * 60 * 1000;

export const runningTooLong = (
  startedAt: Date | null,
  now = Date.now(),
): boolean =>
  startedAt !== null && startedAt.getTime() < now - INSPECTION_PENDING_TTL_MS;

export const INSPECTION_TIMED_OUT =
  'The inspection did not finish in time. Run it again.';

export const INSPECTION_DROPPED =
  'The inspection left the store queue without running. Run it again.';

export const INSPECTION_NOT_QUEUED =
  'The inspection could not be queued. Try again in a few minutes.';

export const INSPECTION_NOT_COLLECTING =
  'This workspace is not collecting store data right now, so the inspection did not run.';

export const INSPECTION_FAILED =
  'The inspection could not read the store. Try again in a few minutes.';

export const inspectionFailureOf = (error: unknown): string =>
  error instanceof StoreRequestError ? error.userMessage : INSPECTION_FAILED;
