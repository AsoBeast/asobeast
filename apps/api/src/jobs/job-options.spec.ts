import { Store } from '@prisma/client';
import {
  DEFERRED_JOB_OPTIONS,
  JOB_OPTIONS,
  REVIEW_SYNC_JOB_OPTIONS,
  reviewSyncJobOptions,
} from './job-options';

describe('REVIEW_SYNC_JOB_OPTIONS', () => {
  it('spreads review sync retries over half an hour', () => {
    const { attempts, backoff } = REVIEW_SYNC_JOB_OPTIONS;
    const delays = Array.from(
      { length: attempts - 1 },
      (_, retry) => backoff.delay * 2 ** retry,
    );

    expect(delays.map((ms) => ms / 60_000)).toEqual([2, 4, 8, 16]);
  });

  it('applies only to the flaky app store review feed', () => {
    expect(reviewSyncJobOptions(Store.APP_STORE)).toBe(REVIEW_SYNC_JOB_OPTIONS);
    expect(reviewSyncJobOptions(Store.GOOGLE_PLAY)).toEqual({});
  });
});

describe('job priority', () => {
  it('leaves the jobs of the daily run without a priority, which BullMQ serves first', () => {
    expect(JOB_OPTIONS).not.toHaveProperty('priority');
  });

  it('gives deferred work an explicit priority, which BullMQ serves after every job without one', () => {
    expect(DEFERRED_JOB_OPTIONS.priority).toBeGreaterThan(0);
  });
});
