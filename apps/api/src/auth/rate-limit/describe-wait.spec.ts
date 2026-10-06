import { describeWait } from './describe-wait';

describe('describeWait', () => {
  it.each([
    [1, '1 second'],
    [54, '54 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [3_540, '59 minutes'],
    [3_600, '1 hour'],
    [3_601, '1 hour 1 minute'],
    [46_275, '12 hours 52 minutes'],
    [86_400, '24 hours'],
  ])('describes %d seconds as %s', (seconds, words) => {
    expect(describeWait(seconds)).toBe(words);
  });

  it.each([
    [0, '1 second'],
    [-5, '1 second'],
    [30.5, '31 seconds'],
    [59.5, '1 minute'],
    [Number.NaN, '1 second'],
  ])('never promises less than a whole second for %d', (seconds, words) => {
    expect(describeWait(seconds)).toBe(words);
  });
});
