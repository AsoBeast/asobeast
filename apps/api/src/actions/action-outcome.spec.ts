import { ActionTrend, ActionTrendPoint } from '@asobeast/shared';
import { measureOutcome } from './action-outcome';

const DAY_MS = 86_400_000;
const CLOSED = new Date('2026-07-20T10:00:00.000Z');
const key = (offset: number): string =>
  new Date(CLOSED.getTime() + offset * DAY_MS).toISOString().slice(0, 10);

const point = (offset: number, value: number | null): ActionTrendPoint => ({
  date: key(offset),
  checked: true,
  value,
});

const trend = (
  points: ActionTrendPoint[],
  overrides: Partial<ActionTrend> = {},
): ActionTrend => ({
  metric: 'position',
  direction: 'lower_is_better',
  depth: 200,
  points,
  ...overrides,
});

describe('measureOutcome', () => {
  it('reads an improved position against the value at close', () => {
    expect(
      measureOutcome(trend([point(-2, 16), point(0, 14), point(5, 8)]), CLOSED),
    ).toEqual({
      metric: 'position',
      direction: 'lower_is_better',
      before: 14,
      beforeDate: key(0),
      after: 8,
      afterDate: key(5),
      change: -6,
      verdict: 'improved',
    });
  });

  it('reads a higher-is-better metric the other way round', () => {
    const visibility = {
      metric: 'visibility',
      direction: 'higher_is_better',
    } as const;

    expect(
      measureOutcome(trend([point(0, 40), point(4, 30)], visibility), CLOSED)
        .verdict,
    ).toBe('worsened');
    expect(
      measureOutcome(trend([point(0, 40), point(4, 52)], visibility), CLOSED)
        .verdict,
    ).toBe('improved');
  });

  it('calls a move within tolerance unchanged', () => {
    expect(
      measureOutcome(trend([point(0, 10), point(4, 11)]), CLOSED).verdict,
    ).toBe('unchanged');
  });

  it('waits three days after the close before judging', () => {
    const outcome = measureOutcome(trend([point(0, 14), point(2, 3)]), CLOSED);

    expect(outcome.change).toBe(-11);
    expect(outcome.verdict).toBe('pending');
  });

  it('stays pending without a measurement on one side', () => {
    const outcome = measureOutcome(
      trend([{ date: key(-1), checked: false, value: null }, point(4, 8)]),
      CLOSED,
    );

    expect(outcome).toMatchObject({
      before: null,
      beforeDate: null,
      change: null,
      verdict: 'pending',
    });
  });

  it('compares an unranked position one past the captured depth', () => {
    const outcome = measureOutcome(
      trend([point(0, null), point(5, 8)]),
      CLOSED,
    );

    expect(outcome).toMatchObject({
      before: null,
      after: 8,
      change: -193,
      verdict: 'improved',
    });
  });

  it('rounds the change to one decimal', () => {
    const rating = { metric: 'rating', direction: 'higher_is_better' } as const;

    expect(
      measureOutcome(trend([point(0, 3.33), point(4, 3.71)], rating), CLOSED)
        .change,
    ).toBe(0.4);
  });
});
