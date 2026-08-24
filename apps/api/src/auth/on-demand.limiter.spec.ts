import { Queue } from 'bullmq';
import { PLAN_LIMITS, PlanName, SELF_HOSTED_LIMITS } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { OnDemandLimitError, OnDemandLimiter } from './on-demand.limiter';
import { secondsUntilReset, windowKey } from './rate-limit/window';
import { QuotaService } from './quota.service';

const INDIE_RUN_DAILY = PLAN_LIMITS.indie.onDemand?.runDaily.limit ?? 0;

const WORKSPACE = 'ws_limits';
const NOW = new Date('2026-08-08T10:30:00Z');

describe('OnDemandLimiter', () => {
  const incr = jest.fn<Promise<number>, [string]>();
  const expire = jest.fn<Promise<number>, [string, number]>();
  const workspace = new WorkspaceContext();

  const queue = {
    getBackend: () => ({ client: Promise.resolve({ incr, expire }) }),
  } as unknown as Queue;

  const limiterWith = (metered: boolean, plan: PlanName = 'indie') =>
    new OnDemandLimiter(queue, workspace, {
      limitsOf: () =>
        Promise.resolve(metered ? PLAN_LIMITS[plan] : SELF_HOSTED_LIMITS),
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

    await expect(rejection).rejects.toBeInstanceOf(OnDemandLimitError);
    await expect(rejection).rejects.toMatchObject({
      retryAfterSeconds: secondsUntilReset(86_400, NOW),
    });
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
