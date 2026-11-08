import type { Job } from 'bullmq';
import { isDatabaseUnavailable } from '../prisma/database-fault';
import { ProxyPoolUnavailableError } from '../store-providers/egress/proxy-pool.service';

export const BUSY_POOL_LIMIT_MS = 24 * 60 * 60_000;
export const DATABASE_RETRY_MS = 5_000;

function retryDelayOf(error: unknown): number | null {
  if (error instanceof ProxyPoolUnavailableError) return error.retryInMs;
  return isDatabaseUnavailable(error) ? DATABASE_RETRY_MS : null;
}

export function busyPoolRetryAt(
  job: Pick<Job, 'timestamp'>,
  error: unknown,
  now = Date.now(),
): number | null {
  const delay = retryDelayOf(error);
  if (delay === null || now - job.timestamp >= BUSY_POOL_LIMIT_MS) return null;
  return now + delay;
}
