import type { ActionOpenedPayload } from '@asobeast/shared';
import { firstRanking, milestone, overtake } from './rank-events.fixture';
import {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertBatchScope,
  CHANGE_FIELDS,
  DigestWeeklyPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
} from '@asobeast/shared';

export const metadata: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App', isCompetitor: false },
  changes: [
    { field: 'title', before: 'A', after: 'B' },
    { field: 'icon', before: null, after: 'y' },
  ],
};

export const dropped: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: {
    id: 'kw_1',
    text: 'fitness app',
    store: 'APP_STORE',
    country: 'us',
  },
  from: 4,
  to: 12,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

export const droppedOut: RankDroppedPayload = {
  ...dropped,
  from: 3,
  to: null,
  fromDepth: 100,
  toDepth: 100,
};

export const improved: RankImprovedPayload = {
  event: 'rank.improved',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  keyword: {
    id: 'kw_1',
    text: 'habit tracker',
    store: 'APP_STORE',
    country: 'de',
  },
  from: 20,
  to: 7,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  threshold: 5,
};

export const negative: ReviewNegativePayload = {
  event: 'review.negative',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'My App' },
  review: {
    score: 1,
    title: 'Bad',
    text: 'Crashes on <launch>',
    version: '2.0.0',
    reviewedAt: '2026-07-10T00:00:00.000Z',
  },
};

export const digest: DigestWeeklyPayload = {
  event: 'digest.weekly',
  occurredAt: '2026-07-13T08:00:00.000Z',
  window: { from: '2026-07-06', to: '2026-07-13' },
  apps: Array.from({ length: 12 }, (_, i) => ({
    id: `app_${i}`,
    name: `App ${i}`,
    visibility: { current: 40 + i, delta7d: i % 2 === 0 ? 2.5 : null },
    moversUp: [],
    moversDown: [],
    changes: i,
    negativeReviews: null,
    audit: i === 0 ? { current: 78, delta7d: 3 } : null,
    actions: null,
  })),
  groups: [],
};

export const digestWithGroups: DigestWeeklyPayload = {
  ...digest,
  groups: [
    {
      id: 'grp_1',
      name: 'Habit',
      visibility: { current: 61.4, delta7d: -2.5 },
    },
  ],
};

export const actionOpened: ActionOpenedPayload = {
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
  keyword: { id: 'k1', text: 'budget planner' },
  evidence: {
    rule: 'keyword.add_uncovered',
    opportunity: 66.5,
    traffic: null,
    difficulty: null,
    volume: 62,
    relevance: 80,
    latestPosition: null,
    indexedFields: ['title', 'subtitle', 'keywordField'],
    uncoveredFields: ['title', 'subtitle', 'keywordField'],
    keywordFieldCharsFree: 18,
    scoreProvenance: null,
  },
  link: 'https://aso.example.com/actions?action=act_1',
};

export const everyFieldChanged: MetadataChangedPayload = {
  ...metadata,
  changes: CHANGE_FIELDS.map((field) => ({
    field,
    before: `${field} before the release, ${'long text '.repeat(8)}`,
    after: `${field} after the release, ${'long text '.repeat(8)}`,
  })),
};

export const emptySection = (
  app: AlertBatchAppSection['app'],
): AlertBatchAppSection => ({
  app,
  rankDrops: [],
  rankImprovements: [],
  rankMilestones: [],
  firstRankings: [],
  overtakes: [],
  serpEntrants: [],
  changes: [],
  negativeReviews: [],
  actions: [],
  competitors: [],
});

export const alpha: AlertBatchAppSection = {
  ...emptySection({
    id: 'a',
    name: 'Alpha',
    store: 'APP_STORE',
    country: 'us',
  }),
  rankDrops: [
    {
      event: 'rank.dropped',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'a', name: 'Alpha' },
      keyword: { id: 'k1', text: 'game', store: 'APP_STORE', country: 'us' },
      from: 3,
      to: 12,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
  ],
  changes: [
    {
      event: 'metadata.changed',
      occurredAt: '2026-07-22T10:00:00.000Z',
      app: { id: 'a', name: 'Alpha', isCompetitor: false },
      changes: [{ field: 'title', before: 'x'.repeat(200), after: 'short' }],
    },
  ],
};

export const competitorAlpha: AlertBatchAppSection = {
  ...emptySection(alpha.app),
  competitors: [
    {
      app: { id: 'c', name: 'Charlie', store: 'APP_STORE', country: 'us' },
      changes: [
        {
          event: 'metadata.changed',
          occurredAt: '2026-07-22T10:00:00.000Z',
          app: { id: 'c', name: 'Charlie', isCompetitor: true },
          changes: [{ field: 'subtitle', before: 'a', after: 'b' }],
        },
      ],
    },
  ],
};

export const bravo: AlertBatchAppSection = {
  ...emptySection({
    id: 'b',
    name: 'Bravo',
    store: 'GOOGLE_PLAY',
    country: 'gb',
  }),
  serpEntrants: [
    {
      event: 'serp.entrant',
      occurredAt: '2026-07-22T10:00:00.000Z',
      keyword: {
        id: 'k2',
        text: 'planner',
        store: 'GOOGLE_PLAY',
        country: 'gb',
      },
      date: '2026-07-22',
      entrants: [
        {
          position: 4,
          storeAppId: 'x',
          title: 'Newcomer',
          appId: null,
          isCompetitor: false,
        },
      ],
    },
  ],
};

export const batch: AlertBatchPayload = {
  event: 'alerts.batch',
  scope: 'owned_apps',
  occurredAt: '2026-07-22T11:00:00.000Z',
  window: { from: '2026-07-22T09:00:00.000Z', to: '2026-07-22T11:00:00.000Z' },
  totals: { events: 3, apps: 2 },
  apps: [alpha, bravo],
  events: [],
};

export const competitorBatch: AlertBatchPayload = {
  ...batch,
  scope: 'competitors',
  totals: { events: 1, apps: 1 },
  apps: [competitorAlpha],
};

const WORST_CASE_SECTIONS = 12;
const WORST_CASE_ENTRIES = 25;
const LONG =
  'a long listing value that runs past the eighty character cut '.repeat(3);

const entries = <T>(build: (index: number) => T): T[] =>
  Array.from({ length: WORST_CASE_ENTRIES }, (_, index) => build(index));

const longChange = (index: number, isCompetitor: boolean) => ({
  ...metadata,
  app: { id: `app_${index}`, name: `App ${index}`, isCompetitor },
  changes: [
    { field: 'subtitle' as const, before: LONG, after: `${LONG}${index}` },
  ],
});

const worstCaseSection = (index: number): AlertBatchAppSection => {
  const keyword = (entry: number) => ({
    ...dropped.keyword,
    id: `kw_${index}_${entry}`,
    text: `meditation and sleep tracker keyword ${entry}`,
  });
  return {
    app: {
      id: `app_${index}`,
      name: `Mindful Sleep and Meditation Coach ${index}`,
      store: 'APP_STORE',
      country: 'us',
    },
    rankDrops: entries((entry) => ({ ...dropped, keyword: keyword(entry) })),
    rankImprovements: entries((entry) => ({
      ...improved,
      keyword: keyword(entry),
    })),
    rankMilestones: entries((entry) => milestone({ keyword: keyword(entry) })),
    firstRankings: entries((entry) =>
      firstRanking({ keyword: keyword(entry) }),
    ),
    overtakes: entries((entry) => overtake({ keyword: keyword(entry) })),
    serpEntrants: entries((entry) => ({
      event: 'serp.entrant' as const,
      occurredAt: dropped.occurredAt,
      keyword: keyword(entry),
      date: '2026-07-11',
      entrants: [
        {
          position: entry + 1,
          storeAppId: `store_${entry}`,
          title: `Calm Breathing and Deep Sleep Sounds ${entry}`,
          appId: null,
          isCompetitor: false,
        },
      ],
    })),
    changes: entries((entry) => longChange(entry, false)),
    negativeReviews: entries(() => ({
      ...negative,
      review: { ...negative.review, text: LONG },
    })),
    actions: entries((entry) => ({
      ...actionOpened,
      keyword: { id: `k_${entry}`, text: `sleep sounds ${entry}` },
    })),
    competitors: Array.from(
      { length: WORST_CASE_SECTIONS },
      (_, competitor) => ({
        app: {
          id: `rival_${competitor}`,
          name: `Rival Sleep Studio ${competitor}`,
          store: 'APP_STORE',
          country: 'us',
        },
        changes: entries((entry) => longChange(entry, true)),
      }),
    ),
  };
};

export const worstCaseBatch = (
  scope: AlertBatchScope | null,
): AlertBatchPayload => {
  const payload: AlertBatchPayload = {
    event: 'alerts.batch',
    scope: scope ?? 'owned_apps',
    occurredAt: '2026-07-22T11:00:00.000Z',
    window: { from: '2026-07-21', to: '2026-07-22' },
    totals: { events: 9_999, apps: WORST_CASE_SECTIONS },
    apps: Array.from({ length: WORST_CASE_SECTIONS }, (_, index) =>
      worstCaseSection(index),
    ),
    events: [],
  };
  if (scope === null) {
    Reflect.deleteProperty(payload, 'scope');
  }
  return payload;
};
