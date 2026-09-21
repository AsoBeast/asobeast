import {
  computeOpportunity,
  defaultRelevance,
  toDifficulty100,
  toVolume,
} from './formulas';

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

  describe('defaultRelevance', () => {
    it('adds the overlap bonus when the keyword is fully in the snapshot', () => {
      expect(
        defaultRelevance('TITLE', 'habit tracker', 'daily habit tracker'),
      ).toBe(100);
    });

    it('subtracts the bonus when there is zero overlap', () => {
      expect(defaultRelevance('COMPETITOR', 'sudoku', 'habit tracker')).toBe(
        40,
      );
    });

    it('keeps the base for partial overlap', () => {
      expect(
        defaultRelevance('SUGGESTED', 'habit journal', 'habit tracker'),
      ).toBe(60);
    });
  });

  describe('computeOpportunity', () => {
    it('is null when volume or difficulty is missing', () => {
      expect(computeOpportunity(null, 40, 90)).toBeNull();
      expect(computeOpportunity(80, null, 90)).toBeNull();
    });

    it('applies the ported 0.4/0.3/0.3 weights', () => {
      expect(computeOpportunity(80, 40, 90)).toBeCloseTo(77, 1);
    });

    it('clamps to a maximum of 100', () => {
      expect(computeOpportunity(100, 0, 100)).toBeCloseTo(100, 1);
    });
  });
});
