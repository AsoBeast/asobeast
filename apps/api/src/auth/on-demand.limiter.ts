import { Injectable } from '@nestjs/common';
import {
  DAY_SECONDS,
  nextPlan,
  type OnDemandAction,
  type RateWindow,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { QuotaService } from './quota.service';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { RateLimitExceededError } from './rate-limit/rate-limit.errors';
import { secondsUntilReset, windowKey } from './rate-limit/window';

const windowOf = (windowSeconds: number): RateWindow =>
  windowSeconds === DAY_SECONDS ? 'day' : 'hour';

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
