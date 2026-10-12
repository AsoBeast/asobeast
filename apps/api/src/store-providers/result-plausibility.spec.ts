import {
  askAgainWhileEmpty,
  DAY_MS,
  EMPTY_ANSWER_RETRY_DELAY_MS,
  IMPLAUSIBLE_LOOKBACK_DAYS,
  isImplausiblyEmpty,
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
