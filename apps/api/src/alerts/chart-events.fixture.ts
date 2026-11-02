import type {
  AlertBatchAppSection,
  AlertBatchPayload,
  ChartEnteredPayload,
  ChartLeftPayload,
  ChartMilestonePayload,
  ChartMovePayload,
  ChartMoveScope,
} from '@asobeast/shared';

const occurredAt = '2026-07-22T10:00:00.000Z';
const app = { id: 'a', name: 'My App' };

export const productivityChart: ChartMoveScope = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6007',
  genreName: 'Productivity',
  device: 'iphone',
};

const base = {
  occurredAt,
  app,
  chart: productivityChart,
  date: '2026-07-22',
  depth: 100,
};

export const chartEntered = (
  overrides: Partial<ChartEnteredPayload> = {},
): ChartEnteredPayload => ({
  ...base,
  event: 'chart.entered',
  from: null,
  to: 7,
  ...overrides,
});

export const chartLeft = (
  overrides: Partial<ChartLeftPayload> = {},
): ChartLeftPayload => ({
  ...base,
  event: 'chart.left',
  from: 7,
  to: null,
  ...overrides,
});

export const chartMilestone = (
  overrides: Partial<ChartMilestonePayload> = {},
): ChartMilestonePayload => ({
  ...base,
  event: 'chart.milestone',
  tier: 10,
  direction: 'entered',
  from: 14,
  to: 8,
  ...overrides,
});

export const chartMoveSection = (
  ...moves: ChartMovePayload[]
): AlertBatchAppSection => ({
  app: { ...app, store: 'APP_STORE', country: 'us' },
  rankDrops: [],
  rankImprovements: [],
  rankMilestones: [],
  firstRankings: [],
  overtakes: [],
  chartMoves: moves,
  serpEntrants: [],
  changes: [],
  negativeReviews: [],
  actions: [],
  competitors: [],
});

export const chartMoveBatch = (
  ...moves: ChartMovePayload[]
): AlertBatchPayload => ({
  event: 'alerts.batch',
  scope: 'owned_apps',
  occurredAt: '2026-07-22T11:00:00.000Z',
  window: { from: '2026-07-22T09:00:00.000Z', to: '2026-07-22T11:00:00.000Z' },
  totals: { events: moves.length, apps: 1 },
  apps: [chartMoveSection(...moves)],
  events: moves,
});

export const withoutChartMoves = (
  section: AlertBatchAppSection,
): AlertBatchAppSection => {
  const queued = { ...section };
  Reflect.deleteProperty(queued, 'chartMoves');
  return queued;
};
