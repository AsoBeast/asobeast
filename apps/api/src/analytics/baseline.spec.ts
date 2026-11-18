import { baselineCheck } from './baseline';
import { DAY_MS, Ranking } from './days';

const T = new Date('2026-07-06T00:00:00.000Z');
const day = (offset: number) => new Date(T.getTime() + offset * DAY_MS);
const check = (offset: number, position: number | null): Ranking => ({
  position,
  depth: 200,
  date: day(offset),
});

describe('baselineCheck', () => {
  it('reads the check on the target day first', () => {
    expect(
      baselineCheck([check(1, 2), check(0, 3), check(-1, 4)], T)?.position,
    ).toBe(3);
  });

  it('reads the day after before the day before', () => {
    expect(baselineCheck([check(-1, 4), check(1, 2)], T)?.position).toBe(2);
  });

  it('reads the day before when nothing nearer exists', () => {
    expect(baselineCheck([check(-1, 4)], T)?.position).toBe(4);
  });

  it('has no baseline further than one day away', () => {
    expect(baselineCheck([check(2, 1), check(-2, 1)], T)).toBeNull();
  });

  it('does not depend on the order of the checks', () => {
    const ascending = [check(-1, 4), check(1, 2)];
    expect(baselineCheck(ascending, T)).toEqual(
      baselineCheck([...ascending].reverse(), T),
    );
  });

  it('keeps a check that found nothing as the baseline', () => {
    expect(baselineCheck([check(0, null), check(1, 5)], T)).toEqual(
      check(0, null),
    );
  });
});
