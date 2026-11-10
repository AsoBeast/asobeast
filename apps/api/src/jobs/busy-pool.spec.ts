import { Prisma, Store } from '@prisma/client';
import { ProxyPoolUnavailableError } from '../store-providers/egress/proxy-pool.service';
import {
  BUSY_POOL_LIMIT_MS,
  busyPoolRetryAt,
  DATABASE_RETRY_MS,
} from './busy-pool';

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

  it('looks again shortly while the database is in crash recovery', () => {
    const recovering = new Prisma.PrismaClientKnownRequestError(
      'Database error. Code: `57P03`. Message: `the database system is in recovery mode`',
      {
        code: 'P2039',
        clientVersion: '7.10.1',
        meta: {
          driverAdapterError: {
            cause: {
              originalCode: '57P03',
              kind: 'postgres',
            },
          },
        },
      },
    );

    expect(busyPoolRetryAt({ timestamp: NOW }, recovering, NOW)).toBe(
      NOW + DATABASE_RETRY_MS,
    );
  });

  it('never delays a job that failed for another reason', () => {
    expect(
      busyPoolRetryAt({ timestamp: NOW }, new Error('parse failure'), NOW),
    ).toBeNull();
  });
});
