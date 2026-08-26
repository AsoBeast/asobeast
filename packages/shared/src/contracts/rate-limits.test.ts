import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, PLAN_NAMES, SELF_HOSTED_LIMITS } from './plans';
import {
  DAY_SECONDS,
  MINUTE_SECONDS,
  RATE_CLASSES,
  budgetOf,
  mcpRateRule,
  rateRules,
} from './rate-limits';

describe('rateRules', () => {
  it('bounds a metered plan by the minute and by the day', () => {
    expect(rateRules(PLAN_LIMITS.indie, 'read')).toEqual([
      {
        window: 'minute',
        budget: 'read',
        limit: PLAN_LIMITS.indie.apiRequestsPerMinute,
        windowSeconds: MINUTE_SECONDS,
      },
      {
        window: 'day',
        budget: 'all',
        limit: PLAN_LIMITS.indie.apiRequestsPerDay,
        windowSeconds: DAY_SECONDS,
      },
    ]);
  });

  it('spends one daily budget whatever the class costs', () => {
    const daily = RATE_CLASSES.map(
      (rateClass) =>
        rateRules(PLAN_LIMITS.indie, rateClass).find(
          ({ window }) => window === 'day',
        )?.budget,
    );

    expect(new Set(daily)).toEqual(new Set(['all']));
  });

  it('splits the per-minute budget by capability, not by class', () => {
    expect(budgetOf('read')).toBe('read');
    expect(budgetOf('write')).toBe('write');
    expect(budgetOf('store')).toBe('write');
  });

  it('holds writes to a tighter burst than reads', () => {
    for (const plan of PLAN_NAMES) {
      const limits = PLAN_LIMITS[plan];
      expect(limits.apiWritesPerMinute).toBeLessThan(
        limits.apiRequestsPerMinute as number,
      );
    }
  });

  it('draws store-touching requests from the write budget', () => {
    expect(rateRules(PLAN_LIMITS.indie, 'store')).toEqual(
      rateRules(PLAN_LIMITS.indie, 'write'),
    );
  });

  it('gives ultimate roughly ten times the daily volume of indie', () => {
    expect(PLAN_LIMITS.ultimate.apiRequestsPerDay).toBe(
      (PLAN_LIMITS.indie.apiRequestsPerDay as number) * 10,
    );
  });

  it('leaves a self hosted instance unbounded in every class', () => {
    for (const rateClass of RATE_CLASSES) {
      expect(rateRules(SELF_HOSTED_LIMITS, rateClass)).toEqual([]);
    }
    expect(SELF_HOSTED_LIMITS.apiConcurrentRequests).toBeNull();
  });

  it('keeps a lapsed workspace able to read what it already paid for', () => {
    expect(PLAN_LIMITS.free.apiRequestsPerMinute).toBe(
      PLAN_LIMITS.indie.apiRequestsPerMinute,
    );
    expect(PLAN_LIMITS.free.apiRequestsPerDay).toBe(
      PLAN_LIMITS.indie.apiRequestsPerDay,
    );
  });
});

describe('mcpRateRule', () => {
  it('caps agent traffic per minute on a metered plan', () => {
    expect(mcpRateRule(PLAN_LIMITS.indie)).toEqual({
      window: 'minute',
      budget: 'mcp',
      limit: 60,
      windowSeconds: MINUTE_SECONDS,
    });
  });

  it('leaves a self hosted instance unmetered', () => {
    expect(mcpRateRule(SELF_HOSTED_LIMITS)).toBeNull();
  });
});
