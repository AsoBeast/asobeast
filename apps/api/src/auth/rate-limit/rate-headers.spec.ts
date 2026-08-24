import { MINUTE_SECONDS, DAY_SECONDS } from '@asobeast/shared';
import {
  applyRateHeaders,
  headersForRefusal,
  headersForUsage,
} from './rate-headers';

const minute = {
  window: 'minute' as const,
  limit: 60,
  windowSeconds: MINUTE_SECONDS,
};
const day = {
  window: 'day' as const,
  limit: 10_000,
  windowSeconds: DAY_SECONDS,
};

describe('headersForUsage', () => {
  it('reports nothing when no limit applies', () => {
    expect(headersForUsage([])).toBeNull();
  });

  it('reports the window closest to closing', () => {
    expect(
      headersForUsage([
        { rule: minute, used: 59, resetSeconds: 12 },
        { rule: day, used: 400, resetSeconds: 5_000 },
      ]),
    ).toEqual({ limit: 60, remaining: 1, reset: 12 });
  });

  it('never reports a negative remaining count', () => {
    expect(
      headersForUsage([{ rule: minute, used: 61, resetSeconds: 3 }]),
    ).toEqual({ limit: 60, remaining: 0, reset: 3 });
  });
});

describe('applyRateHeaders', () => {
  it('writes the ietf header names', () => {
    const written: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        written[name] = value;
      },
    };

    applyRateHeaders(
      res,
      headersForRefusal({
        window: 'minute',
        rateClass: 'write',
        plan: 'indie',
        limit: 20,
        resetSeconds: 30,
        upgradeTo: 'ultimate',
      }),
    );

    expect(written).toEqual({
      'RateLimit-Limit': '20',
      'RateLimit-Remaining': '0',
      'RateLimit-Reset': '30',
    });
  });
});
