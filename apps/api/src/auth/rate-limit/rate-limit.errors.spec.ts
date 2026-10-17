import type { RateLimitDetail } from '@asobeast/shared';
import {
  RateLimitExceededError,
  rateLimitMessage,
  RequestThrottledError,
} from './rate-limit.errors';

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
    ['spider', 'Deep search'],
    ['importApp', 'Import app'],
    ['addCompetitor', 'Add competitor'],
    ['storeLookup', 'Store lookup'],
    ['chartCapture', 'Chart capture'],
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

  it('words the chart capture allowance per day', () => {
    expect(
      rateLimitMessage({
        window: 'day',
        rateClass: 'store',
        plan: 'indie',
        limit: 30,
        resetSeconds: 3_600,
        upgradeTo: 'ultimate',
        action: 'chartCapture',
      }),
    ).toBe(
      'Chart capture limit reached: the indie plan allows 30 requests per day. Try again in 1 hour.',
    );
  });

  it('carries the detail on the error', () => {
    expect(new RateLimitExceededError(DETAIL).detail).toBe(DETAIL);
  });
});

describe('RequestThrottledError', () => {
  it('blames the address by default', () => {
    expect(new RequestThrottledError(12).message).toBe(
      'Too many attempts from this address. Try again in 12 seconds.',
    );
  });

  it('says why when the caller gives a reason', () => {
    expect(new RequestThrottledError(12, 'Too many mails today.').message).toBe(
      'Too many mails today. Try again in 12 seconds.',
    );
  });

  it.each([
    [1, '1 second'],
    [59, '59 seconds'],
    [60, '1 minute'],
    [2_888, '49 minutes'],
    [3_600, '1 hour'],
    [3_661, '1 hour 2 minutes'],
    [86_400, '24 hours'],
  ])('words a wait of %d seconds as %s', (seconds, words) => {
    expect(new RequestThrottledError(seconds).message).toBe(
      `Too many attempts from this address. Try again in ${words}.`,
    );
  });

  it('words a long wait after the reason the caller gives', () => {
    expect(
      new RequestThrottledError(86_400, 'Too many mails today.').message,
    ).toBe('Too many mails today. Try again in 24 hours.');
  });

  it('keeps the wait in seconds on the error', () => {
    expect(new RequestThrottledError(2_888).retryAfterSeconds).toBe(2_888);
  });
});
