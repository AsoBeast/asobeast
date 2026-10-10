import type { ActionOpenedPayload } from '@asobeast/shared';
import {
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
