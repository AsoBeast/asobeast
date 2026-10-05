import { Injectable } from '@nestjs/common';
import {
  DAY_SECONDS,
  HOUR_SECONDS,
  nextPlan,
  type OnDemandAction,
  type RateWindow,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { QuotaService } from './quota.service';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { RateLimitExceededError } from './rate-limit/rate-limit.errors';
import { secondsUntilReset, windowKey } from './rate-limit/window';

const ON_DEMAND_WINDOWS = new Map<number, RateWindow>([
  [HOUR_SECONDS, 'hour'],
  [DAY_SECONDS, 'day'],
]);

function windowOf(windowSeconds: number): RateWindow {
  const window = ON_DEMAND_WINDOWS.get(windowSeconds);
  if (!window) {
    throw new Error(
      `No rate window names an on-demand allowance of ${windowSeconds} seconds`,
    );
  }
  return window;
}

@Injectable()
export class OnDemandLimiter {
  constructor(
    private readonly redis: FailFastRedis,
    private readonly workspace: WorkspaceContext,
    private readonly quota: QuotaService,
  ) {}

  async consume(action: OnDemandAction, now = new Date()): Promise<void> {
    const { plan, limits } = await this.quota.planScope();
    const rules = limits.onDemand;
    if (!rules) return;

    const rule = rules[action];
    const workspaceId = this.workspace.require(`an on-demand ${action}`);
    const key = windowKey(
      'on-demand',
      workspaceId,
      action,
      rule.windowSeconds,
      now,
    );

    const used = await this.redis.run(async (client) => {
      const hits = await client.incr(key);
      if (hits === 1) await client.expire(key, rule.windowSeconds);
      return hits;
    });
    if (used <= rule.limit) return;

    throw new RateLimitExceededError({
      window: windowOf(rule.windowSeconds),
      rateClass: 'store',
      plan,
      limit: rule.limit,
      resetSeconds: secondsUntilReset(rule.windowSeconds, now),
      upgradeTo: nextPlan(plan),
      action,
    });
  }
}
