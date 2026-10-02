import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  mcpRateRule,
  nextPlan,
  rateRules,
  type PlanLimit,
  type RateClass,
  type RateRule,
  type PlanLimits,
  type PlanName,
} from '@asobeast/shared';
import { RateLimitExceededError } from './rate-limit.errors';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { secondsUntilReset, windowKey } from './window';

const CONCURRENCY_TTL_MS = 60_000;

const CONCURRENCY_RENEWAL_MS = CONCURRENCY_TTL_MS / 2;

const ADMIT_SLOT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

const RENEW_SLOT = `
if not redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1
`;

export interface RateUsage {
  rule: RateRule;
  used: number;
  resetSeconds: number;
}

export type RateRelease = () => Promise<void>;

export interface RateScope {
  workspaceId: string;
  plan: PlanName;
  limits: PlanLimits;
}

@Injectable()
export class RequestRateLimiter {
  constructor(private readonly redis: FailFastRedis) {}

  async consume(
    scope: RateScope,
    rateClass: RateClass,
    now = new Date(),
  ): Promise<RateUsage[]> {
    const rules = rateRules(scope.limits, rateClass);
    if (rules.length === 0) return [];

    const usage: RateUsage[] = [];
    for (const rule of rules) {
      const counted = await this.count(scope, rateClass, rule, now);
      if (!counted) break;
      usage.push(counted);
    }
    return usage;
  }

  async consumeMcp(scope: RateScope, now = new Date()): Promise<void> {
    const rule = mcpRateRule(scope.limits);
    if (rule) await this.count(scope, 'read', rule, now);
  }

  private async count(
    scope: RateScope,
    rateClass: RateClass,
    rule: RateRule,
    now: Date,
  ): Promise<RateUsage | null> {
    const key = windowKey(
      'rate',
      scope.workspaceId,
      `${rule.budget}:${rule.window}`,
      rule.windowSeconds,
      now,
    );
    const used = await this.redis.runOpen(async (client) => {
      const hits = await client.incr(key);
      if (hits === 1) await client.expire(key, rule.windowSeconds);
      return hits;
    }, null);
    if (used === null) return null;
    const resetSeconds = secondsUntilReset(rule.windowSeconds, now);
    if (used > rule.limit) {
      throw this.exceeded(
        scope,
        rateClass,
        rule.window,
        rule.limit,
        resetSeconds,
      );
    }
    return { rule, used, resetSeconds };
  }

  async acquire(
    scope: RateScope,
    now = new Date(),
  ): Promise<RateRelease | null> {
    const limit = scope.limits.apiConcurrentRequests;
    if (limit === null) return null;

    const key = `asobeast:concurrency:${scope.workspaceId}`;
    const member = randomUUID();

    const admitted = await this.redis.runOpen<unknown>(
      (client) =>
        client.eval(
          ADMIT_SLOT,
          1,
          key,
          now.getTime() - CONCURRENCY_TTL_MS,
          limit,
          now.getTime(),
          member,
          CONCURRENCY_TTL_MS,
        ),
      null,
    );
    if (admitted === null) return null;
    if (admitted !== 1) {
      throw this.exceeded(scope, 'read', 'concurrent', limit, 1);
    }

    const renewal = setInterval(() => {
      void this.redis.runOpen<unknown>(
        (client) =>
          client.eval(
            RENEW_SLOT,
            1,
            key,
            member,
            Date.now(),
            CONCURRENCY_TTL_MS,
          ),
        null,
      );
    }, CONCURRENCY_RENEWAL_MS);
    renewal.unref();

    return async () => {
      clearInterval(renewal);
      await this.redis.runOpen((client) => client.zrem(key, member), 0);
    };
  }

  private exceeded(
    scope: RateScope,
    rateClass: RateClass,
    window: RateRule['window'],
    limit: PlanLimit,
    resetSeconds: number,
  ): RateLimitExceededError {
    return new RateLimitExceededError({
      window,
      rateClass,
      plan: scope.plan,
      limit: limit ?? 0,
      resetSeconds,
      upgradeTo: nextPlan(scope.plan),
    });
  }
}
