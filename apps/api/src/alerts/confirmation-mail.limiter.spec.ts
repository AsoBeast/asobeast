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

const SECONDS_TO_MIDNIGHT = 7_200;

describe('ConfirmationMailLimiter', () => {
  const evaluate = jest.fn<Promise<unknown>, [string, number, ...unknown[]]>();
  const limiter = new ConfirmationMailLimiter(
    new FailFastRedis({ eval: evaluate } as unknown as Redis),
  );

  const claimed = () => {
    const [, count, ...args] = evaluate.mock.calls[0];
    return { keys: args.slice(0, count), rest: args.slice(count) };
  };

  beforeEach(() => {
    evaluate.mockReset().mockResolvedValue(0);
  });

  it('lets the first confirmation of the day through', async () => {
    await expect(limiter.claim('ws_1', 'a@example.net', NOW)).resolves.toEqual(
      expect.any(Function),
    );
  });

  it('gives back exactly the allowances it counted', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);
    const { keys } = claimed();

    await refund();

    const [, count, ...refunded] = evaluate.mock.calls[1];
    expect(count).toBe(2);
    expect(refunded).toEqual(keys);
  });

  it('keeps a refund from failing while redis is unreachable', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);
    evaluate.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(refund()).resolves.toBeUndefined();
  });

  it('checks the workspace allowance before the recipient in one atomic step', async () => {
    await limiter.claim('ws_1', 'A@Example.net', NOW);

    expect(evaluate).toHaveBeenCalledTimes(1);
    const { keys, rest } = claimed();
    expect(keys[0]).toMatch(/^asobeast:confirmation:ws_1:workspace:/);
    expect(keys[1]).toMatch(/^asobeast:confirmation:[0-9a-f]{64}:recipient:/);
    expect(rest).toEqual([
      CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
      CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
      SECONDS_TO_MIDNIGHT,
    ]);
  });

  it('counts one recipient under one key whatever the letter case', async () => {
    await limiter.claim('ws_1', 'A@Example.net', NOW);
    await limiter.claim('ws_2', 'a@example.net', NOW);

    const recipients = evaluate.mock.calls.map(
      ([, , , recipient]) => recipient,
    );
    expect(recipients[0]).toBe(recipients[1]);
  });

  it('refuses the confirmation after the workspace allowance', async () => {
    evaluate.mockResolvedValue(1);

    const refused = limiter.claim('ws_1', 'a@example.net', NOW);

    await expect(refused).rejects.toBeInstanceOf(RequestThrottledError);
    await expect(refused).rejects.toMatchObject({
      retryAfterSeconds: SECONDS_TO_MIDNIGHT,
      message: expect.stringContaining('this workspace') as string,
    });
  });

  it('refuses the confirmation after the recipient allowance', async () => {
    evaluate.mockResolvedValue(2);

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).rejects.toMatchObject({
      retryAfterSeconds: SECONDS_TO_MIDNIGHT,
      message: expect.stringContaining('this recipient') as string,
    });
  });

  it('fails closed while redis is unreachable', async () => {
    evaluate.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).rejects.toBeInstanceOf(RedisUnavailableError);
  });
});
