import { clamp, finiteNumbers, linear, logScale, median } from './curves';

describe('score curves', () => {
  it('clamps to the 0 to 10 scale', () => {
    expect(clamp(11)).toBe(10);
  });

  it('maps linearly onto the scale', () => {
    expect(linear(5, 0, 10)).toBe(5);
  });

  it('gives 0 on a log scale for a value at or below 0', () => {
    expect(logScale(0, 1, 10)).toBe(0);
  });
});

describe('median', () => {
  it.each([
    [[], 0],
    [[7], 7],
    [[1, 9], 5],
    [[9, 1, 5], 5],
    [[20_000_000, 5, 5, 5, 5, 5, 5, 5, 5, 5], 5],
  ])('median(%j) is %s', (values, expected) => {
    expect(median(values)).toBe(expected);
  });

  it('does not reorder its argument', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('finiteNumbers', () => {
  it('keeps zero and drops everything that is not a finite number', () => {
    expect(
      finiteNumbers([0, 5, Number.NaN, Number.POSITIVE_INFINITY, undefined]),
    ).toEqual([0, 5]);
  });
});
