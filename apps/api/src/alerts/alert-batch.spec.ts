import type { ActionOpenedPayload } from '@asobeast/shared';
import {
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  RankFirstPayload,
  RankImprovedPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
  ReviewNegativePayload,
  ReviewNewPayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import {
  assembleBatches,
  classifyBatch,
  compareOutboxEvents,
  compareResolvedApps,
  filterBatch,
  OutboxEvent,
  ResolvedApp,
} from './alert-batch';
import {
  chartEntered,
  chartLeft,
  chartMilestone,
  chartMoveBatch,
  withoutChartMoves,
} from './chart-events.fixture';
import {
  drop,
  improvement as rankImprovement,
  milestone as rankMilestone,
} from './rank-events.fixture';

const primaryA: ResolvedApp = {
  id: 'a',
  name: 'Alpha',
  iconUrl: null,
  store: 'APP_STORE',
  country: 'us',
  isCompetitor: false,
  primaryAppId: null,
};
const primaryB: ResolvedApp = {
  id: 'b',
  name: 'Bravo',
  iconUrl: null,
  store: 'GOOGLE_PLAY',
  country: 'gb',
  isCompetitor: false,
  primaryAppId: null,
};
const competitor: ResolvedApp = {
  id: 'c',
  name: 'Charlie',
  iconUrl: null,
  store: 'APP_STORE',
  country: 'us',
  isCompetitor: true,
  primaryAppId: 'a',
};

const rank: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'b', name: 'Bravo' },
  keyword: { id: 'kw1', text: 'game' },
  from: 3,
  to: 12,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};
const improvement: RankImprovedPayload = {
  event: 'rank.improved',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'Alpha' },
  keyword: { id: 'kw2', text: 'games' },
  from: 20,
  to: 4,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};
const review: ReviewNegativePayload = {
  event: 'review.negative',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'Alpha' },
  review: {
    score: 1,
    title: null,
    text: 'bad',
    version: '1.0',
    reviewedAt: null,
  },
};
const competitorChange: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'c', name: 'Charlie', isCompetitor: true },
  changes: [{ field: 'title', before: 'x', after: 'y' }],
};
const ownedChange: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'Alpha', isCompetitor: true },
  changes: [{ field: 'subtitle', before: 'old', after: 'new' }],
};
const entrant: SerpEntrantPayload = {
  event: 'serp.entrant',
  occurredAt: '2026-07-22T10:00:00.000Z',
  keyword: { id: 'kw1', text: 'game' },
  date: '2026-07-22',
  entrants: [],
};
const actionOpened: ActionOpenedPayload = {
  event: 'action.opened',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'a', name: 'Alpha', store: 'APP_STORE', country: 'us' },
  action: {
    id: 'act_1',
    rule: 'keyword.add_uncovered',
    category: 'metadata',
    priority: 'high',
    impact: 71,
    firstSeenAt: '2026-07-22T10:00:00.000Z',
    reopened: false,
  },
  keyword: { id: 'kw1', text: 'game' },
  evidence: {
    rule: 'keyword.add_uncovered',
    opportunity: 66.5,
    traffic: null,
    difficulty: null,
    volume: 62,
    relevance: 80,
    latestPosition: null,
    indexedFields: ['title'],
    uncoveredFields: ['title'],
    keywordFieldCharsFree: null,
    scoreProvenance: null,
  },
  link: null,
};

const criticalAction: ActionOpenedPayload = {
  ...actionOpened,
  action: {
    ...actionOpened.action,
    id: 'act_2',
    priority: 'critical',
    impact: 90,
  },
};

const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-07-22T10:00:00.000Z',
  window: { from: '2026-07-15', to: '2026-07-22' },
  apps: [],
  groups: [],
};

const event = (
  payload: OutboxEvent['payload'],
  appId: string | null,
  id?: string,
): OutboxEvent => ({
  id,
  event: payload.event,
  appId,
  payload,
  createdAt: new Date('2026-07-22T09:00:00.000Z'),
});

const appById = new Map<string, ResolvedApp>([
  ['a', primaryA],
  ['b', primaryB],
  ['c', competitor],
]);

describe('classifyBatch', () => {
  it('returns empty classifications and zero skipped counts', () => {
    const result = classifyBatch({
      events: [],
      appById: new Map(),
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.owned).toEqual([]);
    expect(result.competitors).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(Object.values(result.skipped).every((count) => count === 0)).toBe(
      true,
    );
  });

  it('separates every batch event type by resolved database relationships', () => {
    const competitorHintMismatch = {
      ...competitorChange,
      app: { ...competitorChange.app, isCompetitor: false },
    } satisfies MetadataChangedPayload;
    const result = classifyBatch({
      events: [
        event(rank, 'b'),
        event(improvement, 'a'),
        event(review, 'a'),
        event(ownedChange, 'a'),
        event(competitorHintMismatch, 'c'),
        event(entrant, null),
      ],
      appById,
      serpPrimariesByKeyword: new Map([['kw1', ['b']]]),
    });

    expect(result.owned.map(({ event }) => event.payload.event)).toEqual([
      'rank.dropped',
      'rank.improved',
      'review.negative',
      'metadata.changed',
      'serp.entrant',
    ]);
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0]).toMatchObject({
      competitor: { id: 'c' },
      primary: { id: 'a' },
    });
    expect(result.invalid).toHaveLength(0);
  });

  it('counts invalid and unresolved relationships without exposing payloads', () => {
    const orphan: ResolvedApp = {
      ...competitor,
      id: 'orphan',
      name: 'Orphan',
      primaryAppId: null,
    };
    const deletedPrimary: ResolvedApp = {
      ...competitor,
      id: 'deleted-primary',
      name: 'Deleted',
      primaryAppId: 'missing-primary',
    };
    const invalidPrimary: ResolvedApp = {
      ...competitor,
      id: 'invalid-primary',
      name: 'Invalid',
      primaryAppId: 'c',
    };
    const apps = new Map(appById);
    [orphan, deletedPrimary, invalidPrimary].forEach((app) =>
      apps.set(app.id, app),
    );
    const metadataFor = (app: ResolvedApp): MetadataChangedPayload => ({
      ...competitorChange,
      app: { id: app.id, name: app.name, isCompetitor: true },
    });
    const competitorRank = {
      ...rank,
      app: { id: 'c', name: 'Charlie' },
    } satisfies RankDroppedPayload;
    const competitorReview = {
      ...review,
      app: { id: 'c', name: 'Charlie' },
    } satisfies ReviewNegativePayload;
    const result = classifyBatch({
      events: [
        event(rank, 'a'),
        event({ ...rank, app: { id: 'missing', name: null } }, 'missing'),
        event(competitorRank, 'c'),
        event(competitorReview, 'c'),
        event(metadataFor(orphan), orphan.id),
        event(metadataFor(deletedPrimary), deletedPrimary.id),
        event(metadataFor(invalidPrimary), invalidPrimary.id),
        event(entrant, null),
        event(digest, null),
      ],
      appById: apps,
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.owned).toHaveLength(0);
    expect(result.competitors).toHaveLength(0);
    expect(result.invalid).toHaveLength(9);
    expect(result.skipped).toEqual({
      app_mismatch: 1,
      unresolved_app: 1,
      competitor_owned_signal: 2,
      orphan_competitor: 1,
      unresolved_primary: 1,
      invalid_primary: 1,
      serp_without_primary: 1,
      unsupported_event: 1,
    });
  });

  it('deduplicates and sorts SERP primary mappings', () => {
    const result = classifyBatch({
      events: [event(entrant, null)],
      appById,
      serpPrimariesByKeyword: new Map([
        ['kw1', ['b', 'a', 'b', 'missing', 'c']],
      ]),
    });

    expect(result.owned).toHaveLength(1);
    expect(result.owned[0].primaries.map((app) => app.id)).toEqual(['a', 'b']);
    expect(result.skipped.unresolved_primary).toBe(1);
    expect(result.skipped.invalid_primary).toBe(1);
  });

  it('classifies 1,000 events with one app lookup per event', () => {
    const events = Array.from({ length: 1_000 }, (_, index) =>
      event(
        { ...rank, to: index + 1 },
        'b',
        `event-${String(index).padStart(4, '0')}`,
      ),
    );
    const apps = new Map(appById);
    const get = jest.spyOn(apps, 'get');

    const result = classifyBatch({
      events,
      appById: apps,
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.owned).toHaveLength(1_000);
    expect(get).toHaveBeenCalledTimes(1_000);
  });
});

describe('batch comparators', () => {
  it('sorts names case-insensitively with null names last and IDs as ties', () => {
    const apps: ResolvedApp[] = [
      { ...primaryA, id: 'z', name: null },
      { ...primaryA, id: 'b', name: 'alpha' },
      { ...primaryA, id: 'a', name: 'Alpha' },
    ];

    expect(apps.sort(compareResolvedApps).map((app) => app.id)).toEqual([
      'a',
      'b',
      'z',
    ]);
  });

  it('sorts events by creation time and stable row ID', () => {
    const early = event(rank, 'b', 'z');
    early.createdAt = new Date('2026-07-22T08:00:00.000Z');
    const laterA = event(rank, 'b', 'a');
    const laterB = event(rank, 'b', 'b');

    expect(
      [laterB, early, laterA].sort(compareOutboxEvents).map(({ id }) => id),
    ).toEqual(['z', 'a', 'b']);
  });
});

describe('assembleBatches', () => {
  it('separates owned facts from competitor activity', () => {
    const batches = assembleBatches({
      events: [
        event(rank, 'b'),
        event(review, 'a'),
        event(competitorChange, 'c'),
        event(entrant, null),
      ],
      appById,
      serpPrimariesByKeyword: new Map([['kw1', ['b']]]),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(batches.owned).toMatchObject({
      event: 'alerts.batch',
      scope: 'owned_apps',
      totals: { events: 3, apps: 2 },
    });
    expect(batches.competitors).toMatchObject({
      event: 'alerts.batch',
      scope: 'competitors',
      totals: { events: 1, apps: 1 },
    });
    expect(batches.owned.window).toEqual({
      from: '2026-07-22T09:00:00.000Z',
      to: '2026-07-22T11:00:00.000Z',
    });
    expect(batches.owned.apps.map((a) => a.app.id)).toEqual(['a', 'b']);

    const alpha = batches.owned.apps[0];
    expect(alpha.negativeReviews).toHaveLength(1);
    expect(alpha.competitors).toHaveLength(0);

    const bravo = batches.owned.apps[1];
    expect(bravo.rankDrops).toHaveLength(1);
    expect(bravo.serpEntrants).toHaveLength(1);
    const competitorSection = batches.competitors.apps[0];
    expect(competitorSection.rankDrops).toHaveLength(0);
    expect(competitorSection.competitors[0].app.id).toBe('c');
    expect(competitorSection.competitors[0].changes).toHaveLength(1);
  });

  it('carries the current icon of a primary app and of a competitor', () => {
    const alphaIcon =
      'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';
    const charlieIcon =
      'https://is1-ssl.mzstatic.com/image/thumb/charlie/512x512bb.jpg';
    const batches = assembleBatches({
      events: [event(review, 'a'), event(competitorChange, 'c')],
      appById: new Map([
        ['a', { ...primaryA, iconUrl: alphaIcon }],
        ['c', { ...competitor, iconUrl: charlieIcon }],
      ]),
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(batches.owned.apps[0].app).toEqual({
      id: 'a',
      name: 'Alpha',
      iconUrl: alphaIcon,
      store: 'APP_STORE',
      country: 'us',
    });
    const section = batches.competitors.apps[0];
    expect(section.app.iconUrl).toBe(alphaIcon);
    expect(section.competitors[0].app).toEqual({
      id: 'c',
      name: 'Charlie',
      iconUrl: charlieIcon,
      store: 'APP_STORE',
      country: 'us',
    });
  });

  it('removes invalid events from grouped and flat payloads', () => {
    const batches = assembleBatches({
      events: [event(rank, 'b')],
      appById: new Map(),
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });
    expect(batches.owned.apps).toHaveLength(0);
    expect(batches.owned.events).toHaveLength(0);
    expect(batches.competitors.apps).toHaveLength(0);
    expect(batches.competitors.events).toHaveLength(0);
    expect(batches.skipped.unresolved_app).toBe(1);
  });

  it('builds valid scope-specific payload shapes', () => {
    const now = new Date('2026-07-22T11:00:00.000Z');
    const inputEvents = [event(rank, 'b'), event(competitorChange, 'c')];

    expect(
      assembleBatches({
        events: inputEvents,
        appById,
        serpPrimariesByKeyword: new Map(),
        now,
      }),
    ).toMatchObject({
      owned: {
        scope: 'owned_apps',
        totals: { events: 1, apps: 1 },
        apps: [
          {
            app: {
              id: 'b',
              name: 'Bravo',
              iconUrl: null,
              store: 'GOOGLE_PLAY',
              country: 'gb',
            },
            rankDrops: [rank],
            competitors: [],
          },
        ],
        events: [rank],
      },
      competitors: {
        scope: 'competitors',
        totals: { events: 1, apps: 1 },
        apps: [
          {
            app: { id: 'a', name: 'Alpha', store: 'APP_STORE', country: 'us' },
            rankDrops: [],
            rankImprovements: [],
            serpEntrants: [],
            changes: [],
            negativeReviews: [],
            competitors: [
              {
                app: {
                  id: 'c',
                  name: 'Charlie',
                  iconUrl: null,
                  store: 'APP_STORE',
                  country: 'us',
                },
                changes: [competitorChange],
              },
            ],
          },
        ],
        events: [competitorChange],
      },
    });
  });

  it('counts a shared SERP event once across multiple owned sections', () => {
    const batches = assembleBatches({
      events: [event(entrant, null)],
      appById,
      serpPrimariesByKeyword: new Map([['kw1', ['a', 'b']]]),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(batches.owned.totals).toEqual({ events: 1, apps: 2 });
    expect(batches.owned.events).toEqual([entrant]);
    expect(
      batches.owned.apps.every((app) => app.serpEntrants.length === 1),
    ).toBe(true);
  });
});

describe('filterBatch', () => {
  const batches = assembleBatches({
    events: [
      event(rank, 'b'),
      event(review, 'a'),
      event(competitorChange, 'c'),
    ],
    appById,
    serpPrimariesByKeyword: new Map(),
    now: new Date('2026-07-22T11:00:00.000Z'),
  });

  it('keeps only subscribed event types and prunes empty sections', () => {
    const filtered = filterBatch(batches.owned, new Set(['rank.dropped']));
    if (!filtered) throw new Error('expected an owned batch');

    expect(filtered.events).toHaveLength(1);
    expect(filtered.apps.map((a) => a.app.id)).toEqual(['b']);
    expect(filtered.apps[0].negativeReviews).toHaveLength(0);
    expect(filtered.totals).toEqual({ events: 1, apps: 1 });
  });

  it('drops competitor activity when metadata is not subscribed', () => {
    const filtered = filterBatch(
      batches.competitors,
      new Set(['review.negative']),
    );

    expect(filtered).toBeNull();
  });

  it('preserves competitor scope and recalculates distinct app totals', () => {
    const filtered = filterBatch(
      batches.competitors,
      new Set(['metadata.changed']),
    );
    if (!filtered) throw new Error('expected a competitor batch');

    expect(filtered.scope).toBe('competitors');
    expect(filtered.totals).toEqual({ events: 1, apps: 1 });
    expect(filtered.apps[0].rankDrops).toHaveLength(0);
    expect(filtered.apps[0].competitors).toHaveLength(1);
  });
});

describe('filterBatch with confirmed drops', () => {
  const ordinaryDrop = drop();
  const confirmedDrop = drop({ confirmed: true, to: 16 });
  const ordinaryLeave = rankMilestone({ direction: 'left', from: 9, to: 11 });
  const confirmedLeave = rankMilestone({
    direction: 'left',
    from: 9,
    to: 12,
    confirmed: true,
  });
  const entry = rankMilestone();
  const undoingEntry = rankMilestone({ from: 11, to: 9, undoesDrop: true });
  const plainImprovement = rankImprovement();
  const undoingImprovement = rankImprovement({ undoesDrop: true });
  const batchOf = (payloads: OutboxEvent['payload'][]) =>
    assembleBatches({
      events: [
        ...payloads.map((payload, index) => event(payload, 'a', `e${index}`)),
        event(competitorChange, 'c', 'competitor'),
      ],
      appById,
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });
  const batches = batchOf([
    ordinaryDrop,
    confirmedDrop,
    ordinaryLeave,
    confirmedLeave,
    entry,
    undoingEntry,
    plainImprovement,
    undoingImprovement,
  ]);
  const rankEvents = new Set([
    'rank.dropped',
    'rank.improved',
    'rank.milestone',
  ]);
  const filtered = (confirmDrops: boolean) => {
    const result = filterBatch(batches.owned, rankEvents, [], confirmDrops);
    if (!result) throw new Error('expected an owned batch');
    return result;
  };

  it('gives a channel without the setting the ordinary events', () => {
    const [section] = filtered(false).apps;

    expect(section.rankDrops).toEqual([ordinaryDrop]);
    expect(section.rankMilestones).toEqual(
      expect.arrayContaining([ordinaryLeave, entry, undoingEntry]),
    );
    expect(section.rankMilestones).toHaveLength(3);
    expect(section.rankImprovements).toEqual(
      expect.arrayContaining([plainImprovement, undoingImprovement]),
    );
    expect(section.rankImprovements).toHaveLength(2);
  });

  it('gives a confirming channel the confirmed and the plain events', () => {
    const [section] = filtered(true).apps;

    expect(section.rankDrops).toEqual([confirmedDrop]);
    expect(section.rankMilestones).toEqual(
      expect.arrayContaining([confirmedLeave, entry]),
    );
    expect(section.rankMilestones).toHaveLength(2);
    expect(section.rankImprovements).toEqual([plainImprovement]);
  });

  it.each([false, true])(
    'counts the events it keeps when confirmDrops is %p',
    (confirmDrops) => {
      const batch = filtered(confirmDrops);

      expect(batch.totals).toEqual({ events: batch.events.length, apps: 1 });
      expect(batch.events).toHaveLength(confirmDrops ? 4 : 6);
    },
  );

  it('sends a confirming channel no report when nothing reaches it', () => {
    const { owned } = batchOf([ordinaryDrop]);

    expect(filterBatch(owned, rankEvents, [], true)).toBeNull();
  });

  it('leaves the competitor scope alone', () => {
    const competitors = filterBatch(
      batches.competitors,
      new Set(['metadata.changed']),
      [],
      true,
    );
    if (!competitors) throw new Error('expected a competitor batch');

    expect(competitors.totals).toEqual({ events: 1, apps: 1 });
    expect(competitors.apps[0].competitors).toHaveLength(1);
  });
});

describe('action.opened batching', () => {
  it('classifies a new action into the owned-apps scope', () => {
    const result = classifyBatch({
      events: [event(actionOpened, 'a')],
      appById,
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.owned).toHaveLength(1);
    expect(result.competitors).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });

  it('nests actions under their app, critical first then by impact', () => {
    const { owned } = assembleBatches({
      events: [
        event(actionOpened, 'a', 'e1'),
        event(criticalAction, 'a', 'e2'),
      ],
      appById,
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(owned?.apps[0].actions.map((item) => item.action.priority)).toEqual([
      'critical',
      'high',
    ]);
  });

  it('keeps a channel subscribed only to action.opened', () => {
    const { owned } = assembleBatches({
      events: [event(actionOpened, 'a', 'e1')],
      appById,
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });
    const filtered = filterBatch(owned, new Set(['action.opened']));

    expect(filtered?.apps).toHaveLength(1);
    expect(filtered?.apps[0].actions).toHaveLength(1);
    expect(filtered?.apps[0].rankDrops).toHaveLength(0);
  });

  it('drops actions from a channel that did not subscribe to them', () => {
    const { owned } = assembleBatches({
      events: [event(actionOpened, 'a', 'e1')],
      appById,
      serpPrimariesByKeyword: new Map(),
      now: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(filterBatch(owned, new Set(['rank.dropped']))).toBeNull();
  });
});

describe('review.new batching', () => {
  const now = new Date('2026-07-22T11:00:00.000Z');
  const fresh = (score: number, text: string): ReviewNewPayload => ({
    event: 'review.new',
    occurredAt: '2026-07-22T10:00:00.000Z',
    app: { id: 'a', name: 'Alpha' },
    review: {
      score,
      title: null,
      text,
      author: 'Sam',
      version: null,
      reviewedAt: null,
    },
  });
  const low = fresh(2, 'slow');
  const high = fresh(5, 'great');
  const owned = () =>
    assembleBatches({
      events: [event(low, 'a', 'n1'), event(high, 'a', 'n2')],
      appById,
      serpPrimariesByKeyword: new Map(),
      now,
    }).owned;

  it('puts a new review into the new reviews of its owned app', () => {
    expect(owned().apps[0]).toMatchObject({
      newReviews: [low, high],
      negativeReviews: [],
    });
  });

  it('skips a new review keyed on a competitor', () => {
    const result = classifyBatch({
      events: [event({ ...high, app: { id: 'c', name: 'Charlie' } }, 'c')],
      appById,
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.skipped.competitor_owned_signal).toBe(1);
    expect(result.owned).toHaveLength(0);
  });

  it('keeps the picked stars and counts only them', () => {
    const filtered = filterBatch(owned(), new Set(['review.new']), [1, 2]);

    expect(filtered?.apps[0].newReviews).toEqual([low]);
    expect(filtered?.events).toEqual([low]);
    expect(filtered?.totals).toEqual({ events: 1, apps: 1 });
  });

  it('drops a section left with no picked star', () => {
    expect(filterBatch(owned(), new Set(['review.new']), [1])).toBeNull();
  });

  it('keeps every star without a filter', () => {
    expect(
      filterBatch(owned(), new Set(['review.new']))?.apps[0].newReviews,
    ).toEqual([low, high]);
  });
});

describe('rank milestone batching', () => {
  const milestone: RankMilestonePayload = {
    event: 'rank.milestone',
    occurredAt: '2026-07-22T10:00:00.000Z',
    app: { id: 'a', name: 'Alpha' },
    keyword: { id: 'kw1', text: 'game', store: 'APP_STORE', country: 'us' },
    tier: 10,
    direction: 'entered',
    from: 14,
    to: 8,
    fromDepth: RANK_DEPTH,
    toDepth: RANK_DEPTH,
  };

  const firstRanking: RankFirstPayload = {
    event: 'rank.first',
    occurredAt: milestone.occurredAt,
    app: milestone.app,
    keyword: milestone.keyword,
    position: 37,
    depth: RANK_DEPTH,
  };

  const overtake: RankOvertakenPayload = {
    event: 'rank.overtaken',
    occurredAt: milestone.occurredAt,
    app: milestone.app,
    keyword: milestone.keyword,
    competitor: { id: 'c1', name: 'Rival', from: 9, to: 4 },
    from: 5,
    to: 6,
    fromDepth: RANK_DEPTH,
    toDepth: RANK_DEPTH,
  };

  const now = new Date('2026-07-22T11:00:00.000Z');
  const ownedBatch = () =>
    assembleBatches({
      events: [
        event(milestone, 'a', 'e1'),
        event(firstRanking, 'a', 'e2'),
        event(overtake, 'a', 'e3'),
      ],
      appById,
      serpPrimariesByKeyword: new Map(),
      now,
    }).owned;

  it('routes each new rank event into its owned app section', () => {
    const owned = ownedBatch();

    expect(owned.totals).toEqual({ events: 3, apps: 1 });
    expect(owned.events.map((payload) => payload.event)).toEqual([
      'rank.milestone',
      'rank.first',
      'rank.overtaken',
    ]);
    expect(owned.apps[0]).toMatchObject({
      rankMilestones: [milestone],
      firstRankings: [firstRanking],
      overtakes: [overtake],
    });
  });

  it('skips the new rank events keyed on a competitor', () => {
    const onCompetitor = [milestone, firstRanking, overtake].map((payload) =>
      event({ ...payload, app: { id: 'c', name: 'Charlie' } }, 'c'),
    );

    const result = classifyBatch({
      events: onCompetitor,
      appById,
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.skipped.competitor_owned_signal).toBe(3);
    expect(result.owned).toHaveLength(0);
  });

  it('keeps each new array only for a channel that lists its event', () => {
    const owned = ownedBatch();

    expect(
      filterBatch(owned, new Set(['rank.milestone']))?.apps[0],
    ).toMatchObject({
      rankMilestones: [milestone],
      firstRankings: [],
      overtakes: [],
    });
    expect(filterBatch(owned, new Set(['rank.first']))?.apps[0]).toMatchObject({
      rankMilestones: [],
      firstRankings: [firstRanking],
      overtakes: [],
    });
    expect(
      filterBatch(owned, new Set(['rank.overtaken']))?.apps[0],
    ).toMatchObject({
      rankMilestones: [],
      firstRankings: [],
      overtakes: [overtake],
    });
  });

  it('sends nothing to a channel that lists none of the new events', () => {
    const owned = ownedBatch();

    expect(filterBatch(owned, new Set(['rank.dropped']))).toBeNull();
    const overtakesOnly = filterBatch(owned, new Set(['rank.overtaken']));
    expect(overtakesOnly?.apps).toHaveLength(1);
    expect(overtakesOnly?.events).toEqual([overtake]);
    expect(overtakesOnly?.apps[0]).toMatchObject({
      rankDrops: [],
      rankImprovements: [],
      rankMilestones: [],
      firstRankings: [],
      overtakes: [overtake],
      serpEntrants: [],
      changes: [],
      negativeReviews: [],
      actions: [],
      competitors: [],
    });
  });
});

describe('chart move batching', () => {
  const entered = chartEntered({ app: { id: 'a', name: 'Alpha' } });
  const reachedTop10 = chartMilestone({
    app: entered.app,
    from: null,
    to: 7,
  });
  const now = new Date('2026-07-22T11:00:00.000Z');
  const ownedBatch = (...payloads: OutboxEvent['payload'][]) =>
    assembleBatches({
      events: payloads.map((payload, index) =>
        event(payload, 'a', `e${index + 1}`),
      ),
      appById,
      serpPrimariesByKeyword: new Map(),
      now,
    }).owned;

  it('routes a chart move into its owned app section', () => {
    const owned = ownedBatch(entered);

    expect(owned.apps[0].chartMoves).toEqual([entered]);
    expect(owned.events).toEqual([entered]);
    expect(owned.totals).toEqual({ events: 1, apps: 1 });
  });

  it('keeps the entry and the milestone of one move in creation order', () => {
    expect(ownedBatch(entered, reachedTop10).apps[0].chartMoves).toEqual([
      entered,
      reachedTop10,
    ]);
  });

  it('skips a chart move keyed on a competitor', () => {
    const result = classifyBatch({
      events: [event({ ...entered, app: { id: 'c', name: 'Charlie' } }, 'c')],
      appById,
      serpPrimariesByKeyword: new Map(),
    });

    expect(result.skipped.competitor_owned_signal).toBe(1);
    expect(result.owned).toHaveLength(0);
  });

  it('keeps only the chart moves a channel lists', () => {
    const owned = ownedBatch(entered, reachedTop10);
    const milestones = filterBatch(owned, new Set(['chart.milestone']));
    const entries = filterBatch(owned, new Set(['chart.entered']));

    expect(milestones?.apps[0].chartMoves).toEqual([reachedTop10]);
    expect(milestones?.events).toEqual([reachedTop10]);
    expect(entries?.apps[0].chartMoves).toEqual([entered]);
    expect(entries?.events).toEqual([entered]);
  });

  it('drops a section that holds nothing a channel lists', () => {
    expect(
      filterBatch(ownedBatch(entered, chartLeft()), new Set(['rank.dropped'])),
    ).toBeNull();
  });

  it('carries no chart moves in the competitor scope', () => {
    const competitorScope = filterBatch(
      { ...chartMoveBatch(entered), scope: 'competitors' },
      new Set(['chart.entered']),
    );

    expect(competitorScope).toBeNull();
    const competitors = assembleBatches({
      events: [event(competitorChange, 'c')],
      appById,
      serpPrimariesByKeyword: new Map(),
      now,
    }).competitors;
    expect(competitors.apps[0].chartMoves).toEqual([]);
  });

  it('reads a section queued before chart moves existed', () => {
    const queued = chartMoveBatch(entered);
    const legacy = {
      ...queued,
      apps: [withoutChartMoves({ ...queued.apps[0], rankDrops: [rank] })],
      events: [rank],
    };

    const filtered = filterBatch(legacy, new Set(['rank.dropped']));

    expect(filtered?.apps[0].chartMoves).toEqual([]);
    expect(filtered?.apps[0].rankDrops).toEqual([rank]);
  });
});
