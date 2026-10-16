import { isFinalAttempt } from './final-attempt';

describe('isFinalAttempt', () => {
  it.each([
    [0, 3, false],
    [1, 3, false],
    [2, 3, true],
    [0, 1, true],
  ])(
    'answers %s ended of %s attempts as final %s',
    (attemptsMade, attempts, expected) => {
      expect(isFinalAttempt({ attemptsMade, opts: { attempts } })).toBe(
        expected,
      );
    },
  );

  it('treats a job without retries as its final attempt', () => {
    expect(isFinalAttempt({ attemptsMade: 0, opts: {} })).toBe(true);
  });
});
