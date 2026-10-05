import type { Redis } from 'ioredis';
import {
  ON_DEMAND_ACTIONS,
  PLAN_LIMITS,
  PLAN_NAMES,
  PlanName,
  SELF_HOSTED_LIMITS,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { OnDemandLimiter } from './on-demand.limiter';
import { RateLimitExceededError } from './rate-limit/rate-limit.errors';
import { RedisUnavailableError } from '../redis/redis.errors';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { secondsUntilReset, windowKey } from './rate-limit/window';
import { QuotaService } from './quota.service';

const INDIE_RUN_DAILY = PLAN_LIMITS.indie.onDemand?.runDaily.limit ?? 0;

const WORKSPACE = 'ws_limits';
const NOW = new Date('2026-08-08T10:30:00Z');

describe('OnDemandLimiter', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();
  const workspace = new WorkspaceContext();

  const redis = new FailFastRedis({ incr, expire } as unknown as Redis);

  const limiterWith = (metered: boolean, plan: PlanName = 'indie') =>
    new OnDemandLimiter(redis, workspace, {
      planScope: () =>
        Promise.resolve(
          metered
            ? { plan, limits: PLAN_LIMITS[plan] }
            : { plan: 'free', limits: SELF_HOSTED_LIMITS },
        ),
    } as unknown as QuotaService);

  const scoped = <T>(work: () => Promise<T>) => workspace.run(WORKSPACE, work);

  beforeEach(() => {
    incr.mockReset().mockResolvedValue(1);
    expire.mockReset().mockResolvedValue(1);
  });

  it('never limits a self hosted instance', async () => {
    await expect(
      scoped(() => limiterWith(false).consume('refresh', NOW)),
    ).resolves.toBeUndefined();

    expect(incr).not.toHaveBeenCalled();
  });

  it('sets the window expiry on the first request only', async () => {
    await scoped(() => limiterWith(true).consume('refresh', NOW));
    incr.mockResolvedValue(2);
    await scoped(() => limiterWith(true).consume('refresh', NOW));

    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith(
      windowKey('on-demand', WORKSPACE, 'refresh', 86_400, NOW),
      86_400,
    );
  });

  it('admits requests up to the plan limit', async () => {
    incr.mockResolvedValue(INDIE_RUN_DAILY);

    await expect(
      scoped(() => limiterWith(true).consume('runDaily', NOW)),
    ).resolves.toBeUndefined();
  });

  it('refuses the request past the limit and says when it reopens', async () => {
    incr.mockResolvedValue(INDIE_RUN_DAILY + 1);

    const rejection = scoped(() => limiterWith(true).consume('runDaily', NOW));

    await expect(rejection).rejects.toBeInstanceOf(RateLimitExceededError);
    await expect(rejection).rejects.toMatchObject({
      detail: {
        window: 'day',
        rateClass: 'store',
        plan: 'indie',
        limit: INDIE_RUN_DAILY,
        resetSeconds: secondsUntilReset(86_400, NOW),
        upgradeTo: 'ultimate',
        action: 'runDaily',
      },
    });
  });

  it('names an hourly window for keyword suggestions', async () => {
    incr.mockResolvedValue(
      (PLAN_LIMITS.indie.onDemand?.suggestions.limit ?? 0) + 1,
    );

    await expect(
      scoped(() => limiterWith(true).consume('suggestions', NOW)),
    ).rejects.toMatchObject({
      detail: { window: 'hour', resetSeconds: 1_800, action: 'suggestions' },
    });
  });

  it('offers no upgrade to a workspace on the top plan', async () => {
    incr.mockResolvedValue(
      (PLAN_LIMITS.ultimate.onDemand?.runDaily.limit ?? 0) + 1,
    );

    await expect(
      scoped(() => limiterWith(true, 'ultimate').consume('runDaily', NOW)),
    ).rejects.toMatchObject({ detail: { plan: 'ultimate', upgradeTo: null } });
  });

  it.each(
    PLAN_NAMES.flatMap((plan) =>
      ON_DEMAND_ACTIONS.map((action) => [plan, action] as const),
    ),
  )('names the window the %s %s allowance closes in', async (plan, action) => {
    incr.mockResolvedValue(
      (PLAN_LIMITS[plan].onDemand?.[action].limit ?? 0) + 1,
    );

    const rejection = scoped(() =>
      limiterWith(true, plan).consume(action, NOW),
    );

    await expect(rejection).rejects.toBeInstanceOf(RateLimitExceededError);
    await expect(rejection).rejects.toMatchObject({
      detail: {
        window:
          PLAN_LIMITS[plan].onDemand?.[action].windowSeconds === 3_600
            ? 'hour'
            : 'day',
      },
    });
  });

  it('refuses to name a window it has no word for', async () => {
    incr.mockResolvedValue(2);
    const limiter = new OnDemandLimiter(redis, workspace, {
      planScope: () =>
        Promise.resolve({
          plan: 'indie',
          limits: {
            ...PLAN_LIMITS.indie,
            onDemand: {
              ...PLAN_LIMITS.indie.onDemand,
              refresh: { limit: 1, windowSeconds: 600 },
            },
          },
        }),
    } as unknown as QuotaService);

    await expect(scoped(() => limiter.consume('refresh', NOW))).rejects.toThrow(
      '600 seconds',
    );
  });

  it('gives an ultimate workspace the larger allowance', async () => {
    incr.mockResolvedValue(INDIE_RUN_DAILY + 1);

    await expect(
      scoped(() => limiterWith(true, 'ultimate').consume('runDaily', NOW)),
    ).resolves.toBeUndefined();
  });

  it('counts each workspace separately', async () => {
    await workspace.run('ws_a', () =>
      limiterWith(true).consume('suggestions', NOW),
    );
    await workspace.run('ws_b', () =>
      limiterWith(true).consume('suggestions', NOW),
    );

    const keys = incr.mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(2);
  });

  it('counts suggestions in an hourly window, not a daily one', async () => {
    await scoped(() => limiterWith(true).consume('suggestions', NOW));

    expect(expire).toHaveBeenCalledWith(expect.any(String) as string, 3_600);
  });
});

describe('rate limit window keys', () => {
  it('rolls to a new bucket when the window turns over', () => {
    const before = windowKey('on-demand', WORKSPACE, 'refresh', 3_600, NOW);
    const after = windowKey(
      'on-demand',
      WORKSPACE,
      'refresh',
      3_600,
      new Date(NOW.getTime() + 3_600_000),
    );

    expect(before).not.toBe(after);
  });

  it('counts down to the end of the current window', () => {
    expect(secondsUntilReset(3_600, NOW)).toBe(1_800);
  });
});

describe('OnDemandLimiter while redis is unreachable', () => {
  const workspace = new WorkspaceContext();
  const limiter = new OnDemandLimiter(
    new FailFastRedis({
      incr: jest.fn().mockRejectedValue(new Error('Command timed out')),
    } as unknown as Redis),
    workspace,
    {
      planScope: () =>
        Promise.resolve({ plan: 'indie', limits: PLAN_LIMITS.indie }),
    } as unknown as QuotaService,
  );

  it('refuses the store request instead of queueing it uncounted', async () => {
    await expect(
      workspace.run(WORKSPACE, () => limiter.consume('refresh')),
    ).rejects.toBeInstanceOf(RedisUnavailableError);
  });
});
