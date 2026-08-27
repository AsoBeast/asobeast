import type { Job } from 'bullmq';
import type { ErrorTracking } from '../observability/error-tracking.service';

type FailedJob = Pick<Job, 'name' | 'queueName' | 'finishedOn'>;

type Reporter = Pick<ErrorTracking, 'capture'>;

export function retriesExhausted(job: FailedJob | undefined): boolean {
  return job === undefined || typeof job.finishedOn === 'number';
}

export function reportJobFailure(
  tracking: Reporter,
  job: FailedJob | undefined,
  error: Error,
  tags: Record<string, string> = {},
): void {
  if (!retriesExhausted(job)) return;
  tracking.capture(error, {
    ...(job ? { transaction: job.name } : {}),
    tags: { ...(job ? { job: job.name, queue: job.queueName } : {}), ...tags },
  });
}
