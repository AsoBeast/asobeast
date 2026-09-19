import { Store } from '@prisma/client';
import { DefaultJobOptions } from 'bullmq';

export const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} satisfies DefaultJobOptions;

export const REVIEW_SYNC_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2 * 60_000 },
} satisfies DefaultJobOptions;

export function reviewSyncJobOptions(store: Store): DefaultJobOptions {
  return store === Store.APP_STORE ? REVIEW_SYNC_JOB_OPTIONS : {};
}
