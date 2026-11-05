import { ALERT_FEED_DAYS } from '@asobeast/shared';
import {
  feedWhere,
  feedWindowStart,
  type FeedFilter,
} from './alert-feed-where';
import { CONFIRMED_KEY_PREFIXES } from './outbox-rows';

const since = new Date('2026-10-04T00:00:00.000Z');

const filter = (overrides: Partial<FeedFilter> = {}): FeedFilter => ({
  types: ['rank.dropped', 'chart.entered'],
  since,
  after: null,
  appIds: null,
  keywordIds: [],
  cursor: null,
  ...overrides,
});

const notConfirmedCopy = {
  OR: [
    { dedupeKey: null },
    {
      NOT: {
        OR: CONFIRMED_KEY_PREFIXES.map((prefix) => ({
          dedupeKey: { startsWith: prefix },
        })),
      },
    },
  ],
};

const base = [
  { event: { in: ['rank.dropped', 'chart.entered'] } },
  { createdAt: { gte: since } },
  notConfirmedCopy,
];

describe('feedWhere', () => {
  it('scopes to the types and the window and hides confirmed copies', () => {
    expect(feedWhere(filter())).toEqual({ AND: base });
  });

  it('keeps only rows after the caller instant', () => {
    const after = new Date('2026-11-01T00:00:00.000Z');

    expect(feedWhere(filter({ after }))).toEqual({
      AND: [...base, { createdAt: { gt: after } }],
    });
  });

  it('continues strictly below the cursor row', () => {
    const cursor = {
      createdAt: new Date('2026-11-02T00:00:00.000Z'),
      id: 'r5',
    };

    expect(feedWhere(filter({ cursor }))).toEqual({
      AND: [
        ...base,
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: { equals: cursor.createdAt }, id: { lt: 'r5' } },
          ],
        },
      ],
    });
  });

  it('narrows to the apps and the entrants of their keywords', () => {
    expect(
      feedWhere(filter({ appIds: ['a', 'c'], keywordIds: ['k1'] })),
    ).toEqual({
      AND: [
        ...base,
        {
          OR: [
            { appId: { in: ['a', 'c'] } },
            { appId: null, keywordId: { in: ['k1'] } },
          ],
        },
      ],
    });
  });

  it('names both confirmed prefixes in the exclusion', () => {
    expect(CONFIRMED_KEY_PREFIXES).toEqual([
      'rank.confirmed:',
      'milestone.confirmed:',
    ]);
  });
});

describe('feedWindowStart', () => {
  it('looks back the feed window to the millisecond', () => {
    const now = new Date('2026-11-03T10:15:30.123Z');

    expect(now.getTime() - feedWindowStart(now).getTime()).toBe(
      ALERT_FEED_DAYS * 86_400_000,
    );
  });
});
