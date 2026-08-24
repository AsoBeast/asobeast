import { Queue } from 'bullmq';
import { MINUTE_SECONDS } from '@asobeast/shared';
import {
  CREDENTIAL_FAILURES_PER_MINUTE,
  CredentialRateLimiter,
} from './credential-rate.limiter';
import { CredentialRateLimitError } from './rate-limit.errors';
import { windowKey } from './window';

const NOW = new Date('2026-08-14T10:30:30Z');
const ADDRESS = 'ip:203.0.113.7';

describe('CredentialRateLimiter', () => {
  const get = jest.fn<Promise<string | null>, [string]>();
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();

  const queue = {
    getBackend: () => ({ client: Promise.resolve({ get, incr, expire }) }),
  } as unknown as Queue;

  const limiter = new CredentialRateLimiter(queue);

  beforeEach(() => {
    get.mockReset().mockResolvedValue(null);
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
  });

  it('lets an address that has never been rejected through', async () => {
    await expect(
      limiter.assertAddressMayPresentOne(ADDRESS, NOW),
    ).resolves.toBeUndefined();
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

  it('refuses the next credential once the address has burned its budget', async () => {
    get.mockResolvedValue(String(CREDENTIAL_FAILURES_PER_MINUTE));

    const rejection = limiter.assertAddressMayPresentOne(ADDRESS, NOW);

    await expect(rejection).rejects.toBeInstanceOf(CredentialRateLimitError);
    await expect(rejection).rejects.toMatchObject({ retryAfterSeconds: 30 });
  });

  it('still admits the credential that reaches the budget', async () => {
    get.mockResolvedValue(String(CREDENTIAL_FAILURES_PER_MINUTE - 1));

    await expect(
      limiter.assertAddressMayPresentOne(ADDRESS, NOW),
    ).resolves.toBeUndefined();
  });

  it('keeps one address from spending another address budget', async () => {
    await limiter.recordRejection(ADDRESS, NOW);
    await limiter.recordRejection('ip:198.51.100.4', NOW);

    expect(new Set(incr.mock.calls.map(([key]) => key)).size).toBe(2);
  });
});
