import type { Redis } from 'ioredis';
import { PLAN_LIMITS, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import { RateLimitExceededError } from './rate-limit.errors';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { RequestRateLimiter, type RateScope } from './request-rate.limiter';

const NOW = new Date('2026-08-14T10:30:30Z');
const INDIE_READS = PLAN_LIMITS.indie.apiRequestsPerMinute as number;
const INDIE_WRITES = PLAN_LIMITS.indie.apiWritesPerMinute as number;
const INDIE_PARALLEL = PLAN_LIMITS.indie.apiConcurrentRequests as number;
const CONCURRENCY_KEY = 'asobeast:concurrency:ws_acme';

const metered: RateScope = {
  workspaceId: 'ws_acme',
  plan: 'indie',
  limits: PLAN_LIMITS.indie,
};

const selfHosted: RateScope = {
  workspaceId: 'ws_default',
  plan: 'free',
  limits: SELF_HOSTED_LIMITS,
};

describe('RequestRateLimiter', () => {
  const incrby = jest.fn<Promise<number>, [string, number]>();
  const expire = jest.fn<Promise<number>, [string, number]>();
  const evaluate = jest.fn<Promise<unknown>, [string, number, ...unknown[]]>();
  const zrem = jest.fn<Promise<number>, [string, string]>();

  const limiter = new RequestRateLimiter(
    new FailFastRedis({
      incrby,
      expire,
      eval: evaluate,
      zrem,
    } as unknown as Redis),
  );

  const keysOf = (label: string): string[] =>
    incrby.mock.calls.map(([key]) => key).filter((key) => key.includes(label));

  beforeEach(() => {
    incrby.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
    evaluate.mockReset().mockResolvedValue(1);
    zrem.mockReset().mockResolvedValue(1);
  });

  it('never counts a self hosted instance', async () => {
    await expect(limiter.consume(selfHosted, 'read', NOW)).resolves.toEqual([]);
    await expect(limiter.acquire(selfHosted, NOW)).resolves.toBeNull();

    expect(incrby).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('counts the minute and the day in one pass', async () => {
    const usage = await limiter.consume(metered, 'read', NOW);

    expect(usage.map(({ rule }) => rule.window)).toEqual(['minute', 'day']);
    expect(expire).toHaveBeenCalledTimes(2);
  });

  it('opens each window on its first hit only', async () => {
    incrby.mockResolvedValue(2);

    await limiter.consume(metered, 'read', NOW);

    expect(expire).not.toHaveBeenCalled();
  });

  it('refuses a request past the per-minute allowance', async () => {
    incrby.mockResolvedValue(INDIE_READS + 1);

    const rejection = limiter.consume(metered, 'read', NOW);

    await expect(rejection).rejects.toBeInstanceOf(RateLimitExceededError);
    await expect(rejection).rejects.toMatchObject({
      detail: {
        window: 'minute',
        rateClass: 'read',
        plan: 'indie',
        limit: INDIE_READS,
        upgradeTo: 'ultimate',
        resetSeconds: 30,
      },
    });
  });

  it('holds writes to the tighter budget the same reads pass', async () => {
    incrby.mockResolvedValue(INDIE_WRITES + 1);

    await expect(limiter.consume(metered, 'read', NOW)).resolves.toBeDefined();
    await expect(limiter.consume(metered, 'write', NOW)).rejects.toMatchObject({
      detail: { rateClass: 'write' },
    });
  });

  it('draws a store-touching request from the write budget', async () => {
    incrby.mockResolvedValue(INDIE_WRITES + 1);

    await expect(limiter.consume(metered, 'store', NOW)).rejects.toMatchObject({
      detail: { rateClass: 'store', limit: INDIE_WRITES },
    });
  });

  it('spends one daily allowance across every class', async () => {
    await limiter.consume(metered, 'read', NOW);
    await limiter.consume(metered, 'write', NOW);
    await limiter.consume(metered, 'store', NOW);

    expect(new Set(keysOf(':all:day:')).size).toBe(1);
    expect(keysOf(':all:day:')).toHaveLength(3);
  });

  it('spends one per-minute write budget on writes and store requests', async () => {
    await limiter.consume(metered, 'write', NOW);
    await limiter.consume(metered, 'store', NOW);

    expect(new Set(keysOf(':write:minute:')).size).toBe(1);
    expect(keysOf(':read:minute:')).toHaveLength(0);
  });

  it('leaves the read budget alone when a write is spent', async () => {
    await limiter.consume(metered, 'read', NOW);
    await limiter.consume(metered, 'write', NOW);

    expect(new Set(keysOf(':minute:')).size).toBe(2);
  });

  it('counts each workspace separately', async () => {
    await limiter.consume(metered, 'read', NOW);
    await limiter.consume({ ...metered, workspaceId: 'ws_other' }, 'read', NOW);

    expect(new Set(incrby.mock.calls.map(([key]) => key)).size).toBe(4);
  });

  it('admits a request while the workspace is under its parallel cap', async () => {
    const release = await limiter.acquire(metered, NOW);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(
      expect.stringContaining('ZADD') as string,
      1,
      CONCURRENCY_KEY,
      NOW.getTime() - 60_000,
      INDIE_PARALLEL,
      NOW.getTime(),
      expect.any(String) as string,
      60_000,
    );
    await release?.();
    expect(zrem).toHaveBeenCalled();
  });

  it('refuses a request the admission script did not admit', async () => {
    evaluate.mockResolvedValue(0);

    await expect(limiter.acquire(metered, NOW)).rejects.toMatchObject({
      detail: { window: 'concurrent', limit: INDIE_PARALLEL },
    });
  });

  it('prunes, counts and inserts in one round trip so two callers cannot both win', async () => {
    evaluate.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const [first, second] = await Promise.allSettled([
      limiter.acquire(metered, NOW),
      limiter.acquire(metered, NOW),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('renews the lease so a request outliving the window keeps its slot', async () => {
    jest.useFakeTimers();
    try {
      const release = await limiter.acquire(metered, NOW);
      evaluate.mockClear();

      jest.advanceTimersByTime(30_000);
      expect(evaluate).toHaveBeenCalledWith(
        expect.stringContaining('ZSCORE') as string,
        1,
        CONCURRENCY_KEY,
        expect.any(String) as string,
        expect.any(Number) as number,
        60_000,
      );

      await release?.();
      evaluate.mockClear();
      jest.advanceTimersByTime(60_000);
      expect(evaluate).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('caps mcp traffic on its own per-minute window', async () => {
    await limiter.consumeMcp(metered, 1, NOW);

    expect(incrby).toHaveBeenCalledWith(
      expect.stringContaining('mcp:minute'),
      1,
    );
  });

  it('charges a batch its whole cost in one step', async () => {
    incrby.mockResolvedValue(7);

    await limiter.consumeMcp(metered, 7, NOW);

    expect(incrby).toHaveBeenCalledTimes(1);
    expect(incrby).toHaveBeenCalledWith(
      expect.stringContaining('mcp:minute'),
      7,
    );
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('opens the mcp window only when a batch is its first charge', async () => {
    incrby.mockResolvedValue(9);

    await limiter.consumeMcp(metered, 7, NOW);

    expect(expire).not.toHaveBeenCalled();
  });

  it('refuses a batch the remaining allowance cannot cover', async () => {
    incrby.mockResolvedValue(70);

    await expect(limiter.consumeMcp(metered, 20, NOW)).rejects.toMatchObject({
      detail: { window: 'minute', limit: 60 },
    });
    expect(incrby).toHaveBeenCalledWith(expect.any(String), 20);
    expect(expire).not.toHaveBeenCalled();
  });

  it('refuses a batch larger than the whole allowance without charging it', async () => {
    await expect(limiter.consumeMcp(metered, 61, NOW)).rejects.toMatchObject({
      detail: { window: 'minute', limit: 60, upgradeTo: 'ultimate' },
      message: expect.stringContaining(
        'Split it into requests of at most 60 messages',
      ) as string,
    });
    expect(incrby).not.toHaveBeenCalled();
  });

  it('refuses an agent that loops past the mcp cap', async () => {
    incrby.mockResolvedValue(
      (PLAN_LIMITS.indie.mcpRequestsPerMinute as number) + 1,
    );

    await expect(limiter.consumeMcp(metered, 1, NOW)).rejects.toMatchObject({
      detail: { window: 'minute' },
      message: expect.stringContaining(
        'retrying before then will fail',
      ) as string,
    });
  });

  it('names the mcp budget rather than the read budget when it refuses', async () => {
    incrby.mockResolvedValue(
      (PLAN_LIMITS.indie.mcpRequestsPerMinute as number) + 1,
    );

    await expect(limiter.consumeMcp(metered, 1, NOW)).rejects.toMatchObject({
      message: expect.stringContaining(
        'the indie plan allows 60 MCP requests per minute',
      ) as string,
    });
  });

  it('never caps mcp on a self hosted instance', async () => {
    await expect(
      limiter.consumeMcp(selfHosted, 7, NOW),
    ).resolves.toBeUndefined();

    expect(incrby).not.toHaveBeenCalled();
  });
});

describe('RequestRateLimiter while redis is unreachable', () => {
  const unreachable = new Error('Command timed out');
  const evaluate = jest.fn().mockRejectedValue(unreachable);
  const zrem = jest.fn().mockRejectedValue(unreachable);
  const limiter = new RequestRateLimiter(
    new FailFastRedis({
      incrby: jest.fn().mockRejectedValue(unreachable),
      expire: jest.fn(),
      eval: evaluate,
      zrem,
    } as unknown as Redis),
  );

  it('serves the request uncounted instead of waiting', async () => {
    await expect(limiter.consume(metered, 'read', NOW)).resolves.toEqual([]);
  });

  it('serves an mcp request uncounted', async () => {
    await expect(limiter.consumeMcp(metered, 1, NOW)).resolves.toBeUndefined();
  });

  it('admits the request without a parallel slot to give back', async () => {
    await expect(limiter.acquire(metered, NOW)).resolves.toBeNull();
  });

  it('never rejects when a slot cannot be given back', async () => {
    evaluate.mockResolvedValueOnce(1);
    const release = await limiter.acquire(metered, NOW);

    await expect(release?.()).resolves.toBeUndefined();
    expect(zrem).toHaveBeenCalled();
  });
});
