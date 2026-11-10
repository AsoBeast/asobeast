import { BUSY_POOL_LIMIT_MS } from '../jobs/busy-pool';
import { StoreRequestError } from '../store-providers/errors';

export const INSPECTION_PENDING_TTL_MS = 10 * 60 * 1000;

export const INSPECTION_QUEUE_LIMIT_MS = BUSY_POOL_LIMIT_MS;

export const runningTooLong = (
  startedAt: Date | null,
  now = Date.now(),
): boolean =>
  startedAt !== null && startedAt.getTime() < now - INSPECTION_PENDING_TTL_MS;

export const neverStarted = (
  requestedAt: Date,
  startedAt: Date | null,
  now = Date.now(),
): boolean =>
  startedAt === null && requestedAt.getTime() < now - INSPECTION_QUEUE_LIMIT_MS;

export const INSPECTION_TIMED_OUT =
  'The inspection did not finish in time. Run it again.';

export const INSPECTION_NEVER_STARTED =
  'The inspection never reached the store. Run it again.';

export function staleFailureOf(
  row: { status: string; requestedAt: Date; startedAt: Date | null },
  now = Date.now(),
): string | null {
  if (row.status !== 'PENDING') return null;
  if (runningTooLong(row.startedAt, now)) return INSPECTION_TIMED_OUT;
  return neverStarted(row.requestedAt, row.startedAt, now)
    ? INSPECTION_NEVER_STARTED
    : null;
}

export const INSPECTION_NOT_QUEUED =
  'The inspection could not be queued. Try again in a few minutes.';

export const INSPECTION_NOT_COLLECTING =
  'This workspace is not collecting store data right now, so the inspection did not run.';

export const INSPECTION_FAILED =
  'The inspection could not read the store. Try again in a few minutes.';

export const inspectionFailureOf = (error: unknown): string =>
  error instanceof StoreRequestError ? error.userMessage : INSPECTION_FAILED;
