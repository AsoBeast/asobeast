import { Queue } from 'bullmq';
import { PLAN_LIMITS, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import { RateLimitExceededError } from './rate-limit.errors';
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
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();
  const evaluate = jest.fn<Promise<unknown>, [string, number, ...unknown[]]>();
  const zrem = jest.fn<Promise<number>, [string, string]>();

  const queue = {
    getBackend: () => ({
      client: Promise.resolve({ incr, expire, eval: evaluate, zrem }),
    }),
  } as unknown as Queue;

  const limiter = new RequestRateLimiter(queue);

  const keysOf = (label: string): string[] =>
    incr.mock.calls.map(([key]) => key).filter((key) => key.includes(label));

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
    evaluate.mockReset().mockResolvedValue(1);
    zrem.mockReset().mockResolvedValue(1);
  });

  it('never counts a self hosted instance', async () => {
    await expect(limiter.consume(selfHosted, 'read', NOW)).resolves.toEqual([]);
    await expect(limiter.acquire(selfHosted, NOW)).resolves.toBeNull();

    expect(incr).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('counts the minute and the day in one pass', async () => {
    const usage = await limiter.consume(metered, 'read', NOW);

    expect(usage.map(({ rule }) => rule.window)).toEqual(['minute', 'day']);
    expect(expire).toHaveBeenCalledTimes(2);
  });

  it('opens each window on its first hit only', async () => {
    incr.mockResolvedValue(2);

    await limiter.consume(metered, 'read', NOW);

    expect(expire).not.toHaveBeenCalled();
  });

  it('refuses a request past the per-minute allowance', async () => {
    incr.mockResolvedValue(INDIE_READS + 1);

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
    incr.mockResolvedValue(INDIE_WRITES + 1);

    await expect(limiter.consume(metered, 'read', NOW)).resolves.toBeDefined();
    await expect(limiter.consume(metered, 'write', NOW)).rejects.toMatchObject({
      detail: { rateClass: 'write' },
    });
  });

  it('draws a store-touching request from the write budget', async () => {
    incr.mockResolvedValue(INDIE_WRITES + 1);

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

    expect(new Set(incr.mock.calls.map(([key]) => key)).size).toBe(4);
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
    await limiter.consumeMcp(metered, NOW);

    expect(incr).toHaveBeenCalledWith(expect.stringContaining('mcp:minute'));
  });

  it('refuses an agent that loops past the mcp cap', async () => {
    incr.mockResolvedValue(
      (PLAN_LIMITS.indie.mcpRequestsPerMinute as number) + 1,
    );

    await expect(limiter.consumeMcp(metered, NOW)).rejects.toMatchObject({
      detail: { window: 'minute' },
      message: expect.stringContaining(
        'retrying before then will fail',
      ) as string,
    });
  });

  it('never caps mcp on a self hosted instance', async () => {
    await expect(limiter.consumeMcp(selfHosted, NOW)).resolves.toBeUndefined();

    expect(incr).not.toHaveBeenCalled();
  });
});
