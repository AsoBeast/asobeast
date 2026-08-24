import type { RateLimitDetail } from '@asobeast/shared';
import type { RateUsage } from './request-rate.limiter';

export interface RateHeaders {
  limit: number;
  remaining: number;
  reset: number;
}

export function headersForUsage(usage: RateUsage[]): RateHeaders | null {
  let tightest: RateHeaders | null = null;
  for (const { rule, used, resetSeconds } of usage) {
    const headers: RateHeaders = {
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - used),
      reset: resetSeconds,
    };
    if (!tightest || headers.remaining < tightest.remaining) tightest = headers;
  }
  return tightest;
}

export function headersForRefusal(detail: RateLimitDetail): RateHeaders {
  return { limit: detail.limit, remaining: 0, reset: detail.resetSeconds };
}

export interface HeaderSink {
  setHeader(name: string, value: string): void;
}

export function applyRateHeaders(res: HeaderSink, headers: RateHeaders): void {
  res.setHeader('RateLimit-Limit', String(headers.limit));
  res.setHeader('RateLimit-Remaining', String(headers.remaining));
  res.setHeader('RateLimit-Reset', String(headers.reset));
}
