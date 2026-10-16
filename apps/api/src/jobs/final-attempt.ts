import type { Job } from 'bullmq';

export function isFinalAttempt(
  job: Pick<Job, 'attemptsMade'> & { opts: Pick<Job['opts'], 'attempts'> },
): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}
