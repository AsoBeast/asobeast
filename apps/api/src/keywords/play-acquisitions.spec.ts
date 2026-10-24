import { newestAcquisitions } from './play-acquisitions';

const row = (
  month: string,
  normalized: string,
  visitors: number,
  acquisitions: number,
) => ({
  month: new Date(`${month}T00:00:00.000Z`),
  normalized,
  visitors,
  acquisitions,
});

describe('newestAcquisitions', () => {
  it('keeps the newest month of each term and sums its spellings', () => {
    const terms = newestAcquisitions([
      row('2026-08-01', 'habit tracker', 900, 50),
      row('2026-09-01', 'habit tracker', 500, 30),
      row('2026-09-01', 'habit tracker', 10, 1),
      row('2026-07-01', 'habit tracker', 100, 5),
      row('2026-08-01', 'daily planner', 40, 2),
    ]);

    expect(terms.get('habit tracker')).toEqual({
      month: '2026-09-01',
      visitors: 510,
      acquisitions: 31,
    });
    expect(terms.get('daily planner')).toEqual({
      month: '2026-08-01',
      visitors: 40,
      acquisitions: 2,
    });
  });

  it('prefers the newest complete month over the month in progress', () => {
    const terms = newestAcquisitions(
      [
        row('2026-10-01', 'habit tracker', 20, 1),
        row('2026-09-01', 'habit tracker', 900, 50),
        row('2026-10-01', 'daily planner', 30, 2),
      ],
      '2026-10-01',
    );

    expect(terms.get('habit tracker')?.month).toBe('2026-09-01');
    expect(terms.get('daily planner')?.month).toBe('2026-10-01');
  });

  it('answers nothing without rows', () => {
    expect(newestAcquisitions([]).size).toBe(0);
  });
});
