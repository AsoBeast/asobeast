import type { RateLimitDetail } from '@asobeast/shared';
import { RateLimitExceededError, rateLimitMessage } from './rate-limit.errors';

const DETAIL: RateLimitDetail = {
  window: 'minute',
  rateClass: 'write',
  plan: 'indie',
  limit: 60,
  resetSeconds: 34,
  upgradeTo: 'ultimate',
};

describe('rateLimitMessage', () => {
  it('words a plan request limit the way it always did', () => {
    expect(rateLimitMessage(DETAIL)).toBe(
      'Rate limit reached: the indie plan allows 60 write requests per minute. Wait 34 seconds before the next one, because retrying before then will fail.',
    );
  });

  it('names an on demand action and a wait in words', () => {
    expect(
      rateLimitMessage({
        window: 'day',
        rateClass: 'store',
        plan: 'trial',
        limit: 5,
        resetSeconds: 46_275,
        upgradeTo: 'indie',
        action: 'runDaily',
      }),
    ).toBe(
      'Run daily limit reached: the trial plan allows 5 requests per day. Try again in 12 hours 52 minutes.',
    );
  });

  it.each([
    ['refresh', 'Refresh'],
    ['score', 'Score'],
    ['suggestions', 'Keyword suggestions'],
  ] as const)('labels the %s action %s', (action, label) => {
    const message = rateLimitMessage({
      ...DETAIL,
      window: 'hour',
      rateClass: 'store',
      action,
    });

    expect(message).toBe(
      `${label} limit reached: the indie plan allows 60 requests per hour. Try again in 34 seconds.`,
    );
  });

  it('carries the detail on the error', () => {
    expect(new RateLimitExceededError(DETAIL).detail).toBe(DETAIL);
  });
});
