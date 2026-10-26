import { Logger } from '@nestjs/common';
import { ImplausibleResultError } from './errors';
import {
  askAgainWhileEmpty,
  DAY_MS,
  EMPTY_ANSWER_RETRY_DELAY_MS,
  IMPLAUSIBLE_LOOKBACK_DAYS,
  isImplausiblyEmpty,
  settleOnLastAttempt,
} from './result-plausibility';

const TODAY = new Date('2026-08-08T00:00:00.000Z');
const daysAgo = (days: number) => new Date(TODAY.getTime() - days * DAY_MS);

describe('isImplausiblyEmpty', () => {
  it('accepts a result that found something', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 12,
        lastSeenOn: daysAgo(1),
        today: TODAY,
      }),
    ).toBe(false);
  });

  it('rejects nothing found for a phrase that ranked apps yesterday', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastSeenOn: daysAgo(1),
        today: TODAY,
      }),
    ).toBe(true);
  });

  it('accepts nothing found for a phrase that never ranked anything', () => {
    expect(
      isImplausiblyEmpty({ resultCount: 0, lastSeenOn: null, today: TODAY }),
    ).toBe(false);
  });

  it('stops suspecting the proxy once the phrase has been dead for a week', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastSeenOn: daysAgo(IMPLAUSIBLE_LOOKBACK_DAYS),
        today: TODAY,
      }),
    ).toBe(true);
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastSeenOn: daysAgo(IMPLAUSIBLE_LOOKBACK_DAYS + 1),
        today: TODAY,
      }),
    ).toBe(false);
  });

  it('ignores a snapshot that is not in the past', () => {
    expect(
      isImplausiblyEmpty({
        resultCount: 0,
        lastSeenOn: TODAY,
        today: TODAY,
      }),
    ).toBe(false);
  });
});

describe('askAgainWhileEmpty', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('asks once when the first answer has results', async () => {
    const ask = jest.fn().mockResolvedValue(['a']);

    await expect(askAgainWhileEmpty(ask, 3)).resolves.toEqual(['a']);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again after a pause until an answer has results', async () => {
    const ask = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['a']);

    const answer = askAgainWhileEmpty(ask, 3);
    await jest.advanceTimersByTimeAsync(EMPTY_ANSWER_RETRY_DELAY_MS - 1);
    expect(ask).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(EMPTY_ANSWER_RETRY_DELAY_MS + 1);

    await expect(answer).resolves.toEqual(['a']);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('pauses before asking again when it is handed the empty first answer', async () => {
    const ask = jest.fn().mockResolvedValue(['a']);

    const answer = askAgainWhileEmpty(ask, 3, []);
    await jest.advanceTimersByTimeAsync(EMPTY_ANSWER_RETRY_DELAY_MS - 1);
    expect(ask).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    await expect(answer).resolves.toEqual(['a']);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('settles for an empty answer once the retries are spent', async () => {
    const ask = jest.fn().mockResolvedValue([]);

    const answer = askAgainWhileEmpty(ask, 2);
    await jest.runAllTimersAsync();

    await expect(answer).resolves.toEqual([]);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('never asks again without retries', async () => {
    const ask = jest.fn().mockResolvedValue([]);

    await expect(askAgainWhileEmpty(ask, 0)).resolves.toEqual([]);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe('settleOnLastAttempt', () => {
  const logger = new Logger('test');
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const empty = (retryable: boolean) =>
    new ImplausibleResultError('APP_STORE', 'empty', { retryable });
  const attempt = (finalAttempt: boolean) => ({
    finalAttempt,
    logger,
    next: 'check',
    settled: null,
  });

  beforeEach(() => warn.mockClear());

  it('throws a retryable empty answer before the last attempt', () => {
    const error = empty(true);

    expect(() => settleOnLastAttempt(error, attempt(false))).toThrow(error);
    expect(warn).not.toHaveBeenCalled();
  });

  it('throws an empty answer that is never retried, even on the last attempt', () => {
    const error = empty(false);

    expect(() => settleOnLastAttempt(error, attempt(true))).toThrow(error);
  });

  it('settles a retryable empty answer on the last attempt with a warning', () => {
    expect(settleOnLastAttempt(empty(true), attempt(true))).toBeNull();

    expect(warn).toHaveBeenCalledWith(
      'last attempt: APP_STORE returned an implausible result: empty, so nothing changes until the next check',
    );
  });
});
