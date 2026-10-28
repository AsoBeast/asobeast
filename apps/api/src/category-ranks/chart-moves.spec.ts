import type { ChartMoveScope } from '@asobeast/shared';
import { chartMovePayloads, type ChartMoveInput } from './chart-moves';

const chart: ChartMoveScope = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6007',
  genreName: 'Productivity',
  device: 'iphone',
};

const base = {
  occurredAt: '2026-10-28T03:14:07.000Z',
  app: { id: 'a', name: 'My App' },
  chart,
  date: '2026-10-28',
  depth: 100,
};

const movesOf = (from: number | null, to: number | null) =>
  chartMovePayloads({ ...base, from, to });

const summary = (input: Pick<ChartMoveInput, 'from' | 'to'>) =>
  movesOf(input.from, input.to).map((move) =>
    move.event === 'chart.milestone'
      ? `${move.event} ${move.direction} ${move.tier}`
      : move.event,
  );

describe('chartMovePayloads', () => {
  it.each([
    [null, 7, ['chart.entered', 'chart.milestone entered 10']],
    [null, 40, ['chart.entered']],
    [null, 3, ['chart.entered', 'chart.milestone entered 3']],
    [null, 1, ['chart.entered', 'chart.milestone entered 1']],
    [14, 8, ['chart.milestone entered 10']],
    [15, 2, ['chart.milestone entered 3']],
    [2, 1, ['chart.milestone entered 1']],
    [8, 12, ['chart.milestone left 10']],
    [2, 5, ['chart.milestone left 3']],
    [7, null, ['chart.left', 'chart.milestone left 10']],
    [1, null, ['chart.left', 'chart.milestone left 10']],
    [40, null, ['chart.left']],
    [40, 38, []],
    [5, 4, []],
    [null, null, []],
    [11, 10, ['chart.milestone entered 10']],
  ] as const)('reads %p → %p as %j', (from, to, events) => {
    expect(summary({ from, to })).toEqual(events);
  });

  it('carries the base fields on every payload', () => {
    for (const move of movesOf(null, 7)) {
      expect(move).toMatchObject(base);
    }
  });

  it('keeps the positions of an entry, an exit and a milestone', () => {
    expect(movesOf(null, 7)).toEqual([
      { ...base, event: 'chart.entered', from: null, to: 7 },
      {
        ...base,
        event: 'chart.milestone',
        tier: 10,
        direction: 'entered',
        from: null,
        to: 7,
      },
    ]);
    expect(movesOf(40, null)).toEqual([
      { ...base, event: 'chart.left', from: 40, to: null },
    ]);
  });
});
