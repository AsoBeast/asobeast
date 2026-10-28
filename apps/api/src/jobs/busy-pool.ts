import type { Job } from 'bullmq';
import { ProxyPoolUnavailableError } from '../store-providers/egress/proxy-pool.service';

export const BUSY_POOL_LIMIT_MS = 24 * 60 * 60_000;

export function busyPoolRetryAt(
  job: Pick<Job, 'timestamp'>,
  error: unknown,
  now = Date.now(),
): number | null {
  if (!(error instanceof ProxyPoolUnavailableError)) return null;
  if (now - job.timestamp >= BUSY_POOL_LIMIT_MS) return null;
  return now + error.retryInMs;
}
