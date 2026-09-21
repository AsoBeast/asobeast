import { clamp, linear, logScale } from './curves';

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
