import { Injectable, Logger } from '@nestjs/common';
import {
  DAY_SECONDS,
  HOUR_SECONDS,
  nextPlan,
  type OnDemandAction,
  type PlanName,
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

const REFUND_ONE = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('DECR', KEYS[1])
end
return 0
`;

function windowOf(windowSeconds: number): RateWindow {
  const window = ON_DEMAND_WINDOWS.get(windowSeconds);
  if (!window) {
    throw new Error(
      `No rate window names an on-demand allowance of ${windowSeconds} seconds`,
    );
  }
  return window;
}

export interface OnDemandCharge {
  action: OnDemandAction;
  plan: PlanName;
  limit: number;
  windowSeconds: number;
  key: string;
  at: Date;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class OnDemandLimiter {
  private readonly logger = new Logger(OnDemandLimiter.name);

  constructor(
    private readonly redis: FailFastRedis,
    private readonly workspace: WorkspaceContext,
    private readonly quota: QuotaService,
  ) {}

  async consume(action: OnDemandAction, now = new Date()): Promise<void> {
    await this.spend(await this.charge(action, now));
  }

  async charge(
    action: OnDemandAction,
    now = new Date(),
  ): Promise<OnDemandCharge | null> {
    const { plan, limits } = await this.quota.planScope();
    const rule = limits.onDemand?.[action];
    if (!rule) return null;
    return {
      action,
      plan,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
      key: windowKey(
        'on-demand',
        this.workspace.require(`an on-demand ${action}`),
        action,
        rule.windowSeconds,
        now,
      ),
      at: now,
    };
  }

  async spend(charge: OnDemandCharge | null): Promise<void> {
    if (charge === null) return;
    const used = await this.redis.run(async (client) => {
      const hits = await client.incr(charge.key);
      if (hits === 1) await client.expire(charge.key, charge.windowSeconds);
      return hits;
    });
    if (used <= charge.limit) return;

    throw new RateLimitExceededError({
      window: windowOf(charge.windowSeconds),
      rateClass: 'store',
      plan: charge.plan,
      limit: charge.limit,
      resetSeconds: secondsUntilReset(charge.windowSeconds, charge.at),
      upgradeTo: nextPlan(charge.plan),
      action: charge.action,
    });
  }

  async refund(charge: OnDemandCharge | null): Promise<boolean> {
    if (charge === null) return true;
    try {
      await this.redis.run((client) => client.eval(REFUND_ONE, 1, charge.key));
      return true;
    } catch (error) {
      this.logger.warn(
        `on-demand ${charge.action} allowance was not restored: ${messageOf(error)}`,
      );
      return false;
    }
  }
}
