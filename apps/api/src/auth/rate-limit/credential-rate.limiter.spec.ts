import type { Redis } from 'ioredis';
import { MINUTE_SECONDS } from '@asobeast/shared';
import {
  CREDENTIAL_FAILURES_PER_MINUTE,
  CredentialRateLimiter,
} from './credential-rate.limiter';
import { CredentialRateLimitError } from './rate-limit.errors';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { windowKey } from './window';

const NOW = new Date('2026-08-14T10:30:30Z');
const ADDRESS = 'ip:203.0.113.7';

describe('CredentialRateLimiter', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();

  const limiter = new CredentialRateLimiter(
    new FailFastRedis({ incr, expire } as unknown as Redis),
  );

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
  });

  it('counts a rejection in a per-minute window keyed by address', async () => {
    await limiter.recordRejection(ADDRESS, NOW);

    expect(incr).toHaveBeenCalledWith(
      windowKey('credentials', ADDRESS, 'rejected', MINUTE_SECONDS, NOW),
    );
    expect(expire).toHaveBeenCalledWith(
      expect.any(String) as string,
      MINUTE_SECONDS,
    );
  });

  it('opens the window on the first rejection only', async () => {
    incr.mockResolvedValue(2);

    await limiter.recordRejection(ADDRESS, NOW);

    expect(expire).not.toHaveBeenCalled();
  });

  it('lets an address spend its whole budget of rejections', async () => {
    incr.mockResolvedValue(CREDENTIAL_FAILURES_PER_MINUTE);

    await expect(
      limiter.recordRejection(ADDRESS, NOW),
    ).resolves.toBeUndefined();
  });

  it('refuses the rejection that passes the budget', async () => {
    incr.mockResolvedValue(CREDENTIAL_FAILURES_PER_MINUTE + 1);

    const rejection = limiter.recordRejection(ADDRESS, NOW);

    await expect(rejection).rejects.toBeInstanceOf(CredentialRateLimitError);
    await expect(rejection).rejects.toMatchObject({ retryAfterSeconds: 30 });
  });

  it('keeps one address from spending another address budget', async () => {
    await limiter.recordRejection(ADDRESS, NOW);
    await limiter.recordRejection('ip:198.51.100.4', NOW);

    expect(new Set(incr.mock.calls.map(([key]) => key)).size).toBe(2);
  });
});

describe('CredentialRateLimiter while redis is unreachable', () => {
  const unreachable = new Error(
    "Stream isn't writeable and enableOfflineQueue options is false",
  );
  const limiter = new CredentialRateLimiter(
    new FailFastRedis({
      incr: jest.fn().mockRejectedValue(unreachable),
      expire: jest.fn().mockRejectedValue(unreachable),
    } as unknown as Redis),
  );

  it('still lets the guard answer 401 for a refused credential', async () => {
    await expect(
      limiter.recordRejection(ADDRESS, NOW),
    ).resolves.toBeUndefined();
  });
});
