import { DiscoveryRowState } from '@asobeast/shared';
import {
  discoveryStateOf,
  isPending,
  rankDiscoveries,
} from './discovery-state';

describe('discoveryStateOf', () => {
  it('is ranked whenever the app has a position', () => {
    expect(
      discoveryStateOf({ position: 4, relevance: 10, opportunity: null }),
    ).toBe('ranked');
  });

  it('is an opportunity at both inclusive boundaries', () => {
    expect(
      discoveryStateOf({ position: null, relevance: 60, opportunity: 35 }),
    ).toBe('opportunity');
  });

  it.each([
    { relevance: 59, opportunity: 35 },
    { relevance: 60, opportunity: 34 },
    { relevance: 90, opportunity: null },
  ])('is open below either threshold or without a score: %o', (judged) => {
    expect(discoveryStateOf({ position: null, ...judged })).toBe('open');
  });
});

describe('rankDiscoveries', () => {
  const item = (
    text: string,
    relevance: number,
    traffic: number | null,
    state: DiscoveryRowState = 'open',
  ) => ({ text, relevance, traffic, state });

  it('orders by relevance, then traffic with unknown last, then text', () => {
    const { items } = rankDiscoveries([
      item('b', 60, null),
      item('a', 60, null),
      item('c', 60, 4),
      item('d', 90, null),
    ]);
    expect(items.map(({ text }) => text)).toEqual(['d', 'c', 'a', 'b']);
  });

  it('recommends only the first fifty', () => {
    const { items } = rankDiscoveries(
      Array.from({ length: 60 }, (_, index) =>
        item(`k${index}`, 100 - index, 1),
      ),
    );
    expect(items.filter(({ recommended }) => recommended)).toHaveLength(50);
    expect(items[49]?.recommended).toBe(true);
    expect(items[50]?.recommended).toBe(false);
  });

  it('counts every state over the whole input', () => {
    const { counts } = rankDiscoveries([
      item('a', 60, null, 'ranked'),
      item('b', 60, null, 'ranked'),
      item('c', 60, null, 'opportunity'),
      item('d', 60, null),
    ]);
    expect(counts).toEqual({ all: 4, ranked: 2, opportunity: 1 });
  });
});

describe('isPending', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  it('is pending while a check queued within a day has not run', () => {
    expect(
      isPending(
        {
          queuedAt: new Date('2026-11-10T07:30:00Z'),
          checkedOn: null,
          depth: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isPending(
        {
          queuedAt: new Date('2026-11-10T07:30:00Z'),
          checkedOn: '2026-11-03',
          depth: 200,
        },
        now,
      ),
    ).toBe(true);
  });

  it('is not pending once the check ran or the queue day is older than a day', () => {
    expect(
      isPending(
        {
          queuedAt: new Date('2026-11-10T07:30:00Z'),
          checkedOn: '2026-11-10',
          depth: 200,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isPending(
        {
          queuedAt: new Date('2026-11-09T11:00:00Z'),
          checkedOn: null,
          depth: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it('is pending while only a shallow capture answered since the check was queued', () => {
    expect(
      isPending(
        {
          queuedAt: new Date('2026-11-10T07:30:00Z'),
          checkedOn: '2026-11-10',
          depth: 50,
        },
        now,
      ),
    ).toBe(true);
  });

  it('is not pending when nothing was queued', () => {
    expect(
      isPending({ queuedAt: null, checkedOn: null, depth: null }, now),
    ).toBe(false);
  });
});
