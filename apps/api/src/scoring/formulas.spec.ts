import { toDifficulty100, toVolume } from './formulas';

describe('scoring formulas', () => {
  describe('scale bridging', () => {
    it('maps traffic to a 0-100 volume', () => {
      expect(toVolume(8)).toBeCloseTo(80, 2);
      expect(toVolume(12)).toBeCloseTo(100, 2);
    });

    it('maps difficulty to a 0-100 scale', () => {
      expect(toDifficulty100(4)).toBeCloseTo(40, 2);
      expect(toDifficulty100(11)).toBeCloseTo(100, 2);
    });
  });
});
