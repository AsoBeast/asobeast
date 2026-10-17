import { daysInTier, HeldRanking } from './rank-hold';

const day = (offset: number, position: number | null): HeldRanking => {
  const date = new Date(Date.UTC(2026, 8, 20));
  date.setUTCDate(date.getUTCDate() - offset);
  return { position, date };
};

const held = (...rankings: HeldRanking[]) => rankings;

describe('daysInTier', () => {
  it('counts a single checked day as one day held', () => {
    expect(daysInTier(held(day(0, 1)))).toBe(1);
  });

  it('counts consecutive days inside the tier of the latest position', () => {
    expect(daysInTier(held(day(0, 1), day(1, 1), day(2, 1), day(3, 2)))).toBe(
      3,
    );
  });

  it('stops at a day outside the latest tier even when still ranked', () => {
    expect(daysInTier(held(day(0, 2), day(1, 2), day(2, 5), day(3, 2)))).toBe(
      2,
    );
  });

  it('keeps counting days spent in a better tier', () => {
    expect(daysInTier(held(day(0, 2), day(1, 1), day(2, 1), day(3, 5)))).toBe(
      3,
    );
  });

  it('stops at a day without a ranking row', () => {
    expect(daysInTier(held(day(0, 1), day(2, 1), day(3, 1)))).toBe(1);
  });

  it('stops at an unranked day inside the window', () => {
    expect(daysInTier(held(day(0, 3), day(1, null), day(2, 3)))).toBe(1);
  });

  it('reports null when the latest position is unranked', () => {
    expect(daysInTier(held(day(0, null), day(1, 1)))).toBeNull();
  });

  it('reports null when the latest position sits outside every tier', () => {
    expect(daysInTier(held(day(0, 25), day(1, 2), day(2, 2)))).toBeNull();
  });

  it('reports null without rankings', () => {
    expect(daysInTier(held())).toBeNull();
  });
});
