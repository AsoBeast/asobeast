import type { Redis } from 'ioredis';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { RedisUnavailableError } from '../redis/redis.errors';
import { FailFastRedis } from '../redis/fail-fast-redis';
import {
  CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
  CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
  ConfirmationMailLimiter,
} from './confirmation-mail.limiter';

const NOW = new Date('2026-10-11T22:00:00Z');

describe('ConfirmationMailLimiter', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();
  const limiter = new ConfirmationMailLimiter(
    new FailFastRedis({ incr, expire } as unknown as Redis),
  );

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
  });

  it('lets the first confirmation of the day through', async () => {
    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).resolves.toBeUndefined();
  });

  it('counts the recipient and the workspace in separate daily windows', async () => {
    await limiter.claim('ws_1', 'A@Example.net', NOW);

    const keys = incr.mock.calls.map(([key]) => key);
    expect(keys[0]).toMatch(/^asobeast:confirmation:[0-9a-f]{64}:recipient:/);
    expect(keys[1]).toMatch(/^asobeast:confirmation:ws_1:workspace:/);
    expect(expire).toHaveBeenCalledWith(keys[0], 86_400);
    await limiter.claim('ws_1', 'a@example.net', NOW);
    expect(incr.mock.calls[2][0]).toBe(keys[0]);
  });

  it('refuses the confirmation after the recipient allowance', async () => {
    incr.mockResolvedValueOnce(CONFIRMATIONS_PER_RECIPIENT_PER_DAY + 1);

    const refused = limiter.claim('ws_1', 'a@example.net', NOW);

    await expect(refused).rejects.toBeInstanceOf(RequestThrottledError);
    await expect(refused).rejects.toMatchObject({
      retryAfterSeconds: 7_200,
      message: expect.stringContaining('this recipient') as string,
    });
  });

  it('refuses the confirmation after the workspace allowance', async () => {
    incr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(CONFIRMATIONS_PER_WORKSPACE_PER_DAY + 1);

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).rejects.toMatchObject({
      message: expect.stringContaining('this workspace') as string,
    });
  });

  it('lets the last confirmation of each allowance through', async () => {
    incr
      .mockResolvedValueOnce(CONFIRMATIONS_PER_RECIPIENT_PER_DAY)
      .mockResolvedValueOnce(CONFIRMATIONS_PER_WORKSPACE_PER_DAY);

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).resolves.toBeUndefined();
  });

  it('fails closed while redis is unreachable', async () => {
    incr.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).rejects.toBeInstanceOf(RedisUnavailableError);
  });
});
