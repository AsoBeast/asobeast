import type { ActionOpenedPayload } from '@asobeast/shared';
import {
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
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

const primaryA: ResolvedApp = {
  id: 'a',
  name: 'Alpha',
  store: 'APP_STORE',
  country: 'us',
  isCompetitor: false,
  primaryAppId: null,
};
const primaryB: ResolvedApp = {
  id: 'b',
  name: 'Bravo',
  store: 'GOOGLE_PLAY',
  country: 'gb',
  isCompetitor: false,
  primaryAppId: null,
};
const competitor: ResolvedApp = {
  id: 'c',
  name: 'Charlie',
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
