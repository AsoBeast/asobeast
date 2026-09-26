import {
  AlertBatchAppSection,
  RANK_DEPTH,
  RankFirstPayload,
  RankMilestonePayload,
  RankOvertakenPayload,
} from '@asobeast/shared';

const occurredAt = '2026-07-22T10:00:00.000Z';
const app = { id: 'a', name: 'My App' };
const keyword = {
  id: 'k',
  text: 'habit tracker',
  store: 'APP_STORE' as const,
  country: 'us',
};

export const milestone = (
  overrides: Partial<RankMilestonePayload> = {},
): RankMilestonePayload => ({
  event: 'rank.milestone',
  occurredAt,
  app,
  keyword,
  tier: 10,
  direction: 'entered',
  from: 14,
  to: 8,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  ...overrides,
});

export const firstRanking = (
  overrides: Partial<RankFirstPayload> = {},
): RankFirstPayload => ({
  event: 'rank.first',
  occurredAt,
  app,
  keyword,
  position: 37,
  depth: RANK_DEPTH,
  ...overrides,
});

export const overtake = (
  overrides: Partial<RankOvertakenPayload> = {},
): RankOvertakenPayload => ({
  event: 'rank.overtaken',
  occurredAt,
  app,
  keyword,
  competitor: { id: 'r', name: 'Rival Focus', from: 9, to: 4 },
  from: 5,
  to: 6,
  fromDepth: RANK_DEPTH,
  toDepth: RANK_DEPTH,
  ...overrides,
});

export const rankEventSection = (): AlertBatchAppSection => ({
  app: { ...app, store: 'APP_STORE', country: 'us' },
  rankDrops: [],
  rankImprovements: [],
  rankMilestones: [milestone()],
  firstRankings: [firstRanking()],
  overtakes: [overtake()],
  serpEntrants: [],
  changes: [],
  negativeReviews: [],
  actions: [],
  competitors: [],
});

export const withoutRankEvents = (
  section: AlertBatchAppSection,
): AlertBatchAppSection => {
  const queued = { ...section };
  Reflect.deleteProperty(queued, 'rankMilestones');
  Reflect.deleteProperty(queued, 'firstRankings');
  Reflect.deleteProperty(queued, 'overtakes');
  return queued;
};
