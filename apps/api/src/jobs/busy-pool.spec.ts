import { Store } from '@prisma/client';
import { ProxyPoolUnavailableError } from '../store-providers/egress/proxy-pool.service';
import { BUSY_POOL_LIMIT_MS, busyPoolRetryAt } from './busy-pool';

const NOW = Date.parse('2026-10-28T12:00:00.000Z');
const busy = new ProxyPoolUnavailableError(Store.GOOGLE_PLAY, 120_000, 5_000);

describe('busyPoolRetryAt', () => {
  it('looks again one poll interval later while the job is young enough', () => {
    expect(busyPoolRetryAt({ timestamp: NOW - 60_000 }, busy, NOW)).toBe(
      NOW + 5_000,
    );
  });

  it('lets a job that waited for the whole limit fail', () => {
    expect(
      busyPoolRetryAt({ timestamp: NOW - BUSY_POOL_LIMIT_MS }, busy, NOW),
    ).toBeNull();
  });

  it('never delays a job that failed for another reason', () => {
    expect(
      busyPoolRetryAt({ timestamp: NOW }, new Error('parse failure'), NOW),
    ).toBeNull();
  });
});
