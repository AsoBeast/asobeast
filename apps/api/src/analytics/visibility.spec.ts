import { positionWeight, visibility } from './visibility';

describe('positionWeight', () => {
  it('is zero when not ranked', () => {
    expect(positionWeight(null)).toBe(0);
  });

  it('decays with position', () => {
    expect(positionWeight(1)).toBeCloseTo(1, 2);
    expect(positionWeight(3)).toBeCloseTo(0.5, 2);
    expect(positionWeight(10)).toBeCloseTo(0.29, 2);
    expect(positionWeight(100)).toBeCloseTo(0.15, 2);
  });
});

describe('visibility', () => {
  it('weights traffic by position and normalizes to 0..100', () => {
    expect(
      visibility([
        { traffic: 8, position: 1 },
        { traffic: 4, position: null },
      ]),
    ).toBeCloseTo(66.7, 1);
  });

  it('defaults unscored keywords to weak traffic of 1', () => {
    expect(
      visibility([
        { traffic: null, position: 1 },
        { traffic: null, position: null },
      ]),
    ).toBeCloseTo(50, 1);
  });

  it('is zero when total traffic is zero or there are no keywords', () => {
    expect(visibility([])).toBe(0);
    expect(visibility([{ traffic: 0, position: 1 }])).toBe(0);
  });
});
