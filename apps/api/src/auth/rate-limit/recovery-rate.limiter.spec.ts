import { Queue } from 'bullmq';
import { sha256 } from '../password-hash';
import {
  RECOVERY_REQUESTS_PER_HOUR,
  RecoveryRateLimiter,
} from './recovery-rate.limiter';

const NOW = new Date('2026-08-20T10:30:30Z');
const ACCOUNT = 'owner@example.com';

describe('RecoveryRateLimiter', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();

  const limiter = new RecoveryRateLimiter({
    getBackend: () => ({ client: Promise.resolve({ incr, expire }) }),
  } as unknown as Queue);

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
  });

  it('lets the first request of the hour through', async () => {
    await expect(limiter.claim(ACCOUNT, NOW)).resolves.toBe(true);
  });

  it('lets the last request of the allowance through', async () => {
    incr.mockResolvedValue(RECOVERY_REQUESTS_PER_HOUR);

    await expect(limiter.claim(ACCOUNT, NOW)).resolves.toBe(true);
  });

  it('refuses the request after the allowance', async () => {
    incr.mockResolvedValue(RECOVERY_REQUESTS_PER_HOUR + 1);

    await expect(limiter.claim(ACCOUNT, NOW)).resolves.toBe(false);
  });

  it('expires the counter with the window it opened', async () => {
    await limiter.claim(ACCOUNT, NOW);

    expect(expire).toHaveBeenCalledWith(incr.mock.calls[0][0], 3600);
  });

  it('leaves an already open window to expire on its own schedule', async () => {
    incr.mockResolvedValue(2);

    await limiter.claim(ACCOUNT, NOW);

    expect(expire).not.toHaveBeenCalled();
  });

  it('never writes the address it is counting into the key', async () => {
    await limiter.claim(ACCOUNT, NOW);

    const key = incr.mock.calls[0][0];
    expect(key).not.toContain(ACCOUNT);
    expect(key).toContain(sha256(ACCOUNT));
  });

  it('counts two accounts separately', async () => {
    await limiter.claim(ACCOUNT, NOW);
    await limiter.claim('other@example.com', NOW);

    expect(incr.mock.calls[0][0]).not.toBe(incr.mock.calls[1][0]);
  });
});
