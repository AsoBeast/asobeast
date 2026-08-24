import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
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
import { QUEUES } from '../../jobs/jobs.types';
import { RateLimitExceededError } from './rate-limit.errors';
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

interface RateCounterClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  eval(
    script: string,
    keyCount: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  zrem(key: string, member: string): Promise<number>;
}

export interface RateScope {
  workspaceId: string;
  plan: PlanName;
  limits: PlanLimits;
}

@Injectable()
export class RequestRateLimiter {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue) {}

  async consume(
    scope: RateScope,
    rateClass: RateClass,
    now = new Date(),
  ): Promise<RateUsage[]> {
    const rules = rateRules(scope.limits, rateClass);
    if (rules.length === 0) return [];

    const usage: RateUsage[] = [];
    for (const rule of rules) {
      usage.push(await this.count(scope, rateClass, rule, now));
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
  ): Promise<RateUsage> {
    const client = await this.client();
    const key = windowKey(
      'rate',
      scope.workspaceId,
      `${rule.budget}:${rule.window}`,
      rule.windowSeconds,
      now,
    );
    const used = await client.incr(key);
    if (used === 1) await client.expire(key, rule.windowSeconds);
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

    const client = await this.client();
    const key = `asobeast:concurrency:${scope.workspaceId}`;
    const member = randomUUID();

    const admitted = await client.eval(
      ADMIT_SLOT,
      1,
      key,
      now.getTime() - CONCURRENCY_TTL_MS,
      limit,
      now.getTime(),
      member,
      CONCURRENCY_TTL_MS,
    );
    if (admitted !== 1) {
      throw this.exceeded(scope, 'read', 'concurrent', limit, 1);
    }

    const renewal = setInterval(() => {
      void client
        .eval(RENEW_SLOT, 1, key, member, Date.now(), CONCURRENCY_TTL_MS)
        .catch(() => undefined);
    }, CONCURRENCY_RENEWAL_MS);
    renewal.unref();

    return async () => {
      clearInterval(renewal);
      await client.zrem(key, member);
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

  private async client(): Promise<RateCounterClient> {
    return (await this.queue.getBackend()
      .client) as unknown as RateCounterClient;
  }
}
