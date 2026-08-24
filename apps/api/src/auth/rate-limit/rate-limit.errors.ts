import type { RateLimitDetail } from '@asobeast/shared';

const WINDOW_NAMES: Record<RateLimitDetail['window'], string> = {
  minute: 'per minute',
  day: 'per day',
  concurrent: 'in parallel',
};

export function rateLimitMessage(detail: RateLimitDetail): string {
  const allowance = `the ${detail.plan} plan allows ${detail.limit} ${detail.rateClass} requests ${WINDOW_NAMES[detail.window]}`;
  const reopens =
    detail.window === 'concurrent'
      ? 'Send fewer requests at once'
      : `Wait ${detail.resetSeconds} seconds before the next one, because retrying before then will fail`;
  return `Rate limit reached: ${allowance}. ${reopens}.`;
}

export class CredentialRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `Too many rejected credentials from this address. Wait ${retryAfterSeconds} seconds before presenting another one.`,
    );
    this.name = 'CredentialRateLimitError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(readonly detail: RateLimitDetail) {
    super(rateLimitMessage(detail));
    this.name = 'RateLimitExceededError';
  }
}
