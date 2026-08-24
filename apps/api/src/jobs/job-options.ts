import { DefaultJobOptions } from 'bullmq';

export const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} satisfies DefaultJobOptions;
