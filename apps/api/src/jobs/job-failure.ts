import type { Job } from 'bullmq';
import type { ErrorTracking } from '../observability/error-tracking.service';

export function retriesExhausted(job: Job | undefined): boolean {
  return job === undefined || typeof job.finishedOn === 'number';
}

export function reportJobFailure(
  tracking: ErrorTracking,
  job: Job | undefined,
  error: Error,
  tags: Record<string, string> = {},
): void {
  if (!retriesExhausted(job)) return;
  tracking.capture(error, {
    ...(job ? { transaction: job.name } : {}),
    tags: { ...(job ? { job: job.name, queue: job.queueName } : {}), ...tags },
  });
}
