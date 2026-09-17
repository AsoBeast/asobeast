import { Store } from '@prisma/client';
import {
  AuditBenchmarkMetric,
  AuditBenchmarkRow,
  AuditBenchmarks,
} from '@asobeast/shared';
import { round1 } from './audit-engine';
import { AuditCompetitor, AuditContext, DAY_MS } from './audit-scoring';
import { visibleScreenshots } from './checks/creative-checks';

type Direction = 'higher' | 'lower';

interface BenchmarkMetric {
  metric: AuditBenchmarkMetric;
  label: string;
  better: Direction;
  stores: readonly Store[];
  you: (context: AuditContext) => number | null;
  them: (competitor: AuditCompetitor, context: AuditContext) => number | null;
}

const BOTH_STORES = [Store.APP_STORE, Store.GOOGLE_PLAY] as const;

const daysSince = (date: Date | null, now: Date): number | null =>
  date === null ? null : Math.floor((now.getTime() - date.getTime()) / DAY_MS);

export const BENCHMARK_METRICS: readonly BenchmarkMetric[] = [
  {
    metric: 'rating-average',
    label: 'Average rating',
    better: 'higher',
    stores: BOTH_STORES,
    you: (context) => context.ratingAvg,
    them: (competitor) => competitor.ratingAvg,
  },
  {
    metric: 'rating-count',
    label: 'Ratings',
    better: 'higher',
    stores: BOTH_STORES,
    you: (context) => context.ratingCount,
    them: (competitor) => competitor.ratingCount,
  },
  {
    metric: 'screenshots',
    label: 'Screenshots',
    better: 'higher',
    stores: BOTH_STORES,
    you: (context) =>
      visibleScreenshots(context.store, context.rawFacts.screenshotCount),
    them: (competitor, context) =>
      visibleScreenshots(context.store, competitor.screenshotCount),
  },
  {
    metric: 'has-video',
    label: 'Preview video',
    better: 'higher',
    stores: [Store.GOOGLE_PLAY],
    you: (context) => (context.rawFacts.videoUrl === null ? 0 : 1),
    them: (competitor) => (competitor.hasVideo ? 1 : 0),
  },
  {
    metric: 'title-length',
    label: 'Title characters',
    better: 'higher',
    stores: BOTH_STORES,
    you: (context) => context.title.length,
    them: (competitor) => competitor.title?.length ?? null,
  },
  {
    metric: 'subtitle-length',
    label: 'Subtitle characters',
    better: 'higher',
    stores: [Store.APP_STORE],
    you: (context) => context.subtitle?.length ?? null,
    them: (competitor) => competitor.subtitle?.length ?? null,
  },
  {
    metric: 'days-since-update',
    label: 'Days since update',
    better: 'lower',
    stores: BOTH_STORES,
    you: (context) => daysSince(context.storeUpdatedAt, context.now),
    them: (competitor, context) =>
      daysSince(competitor.storeUpdatedAt, context.now),
  },
];

export const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round1((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
};

export const bestOf = (
  entries: { id: string; value: number }[],
  better: Direction,
): { best: number; bestAppId: string } | null => {
  if (entries.length === 0) {
    return null;
  }
  const winner = entries.reduce((chosen, entry) =>
    better === 'higher'
      ? entry.value > chosen.value
        ? entry
        : chosen
      : entry.value < chosen.value
        ? entry
        : chosen,
  );
  return { best: winner.value, bestAppId: winner.id };
};

export function buildBenchmarks(context: AuditContext): AuditBenchmarks | null {
  if (context.competitors.length === 0) {
    return null;
  }
  const rows: AuditBenchmarkRow[] = BENCHMARK_METRICS.filter((metric) =>
    metric.stores.includes(context.store),
  ).map((metric) => {
    const entries = context.competitors
      .map((competitor) => ({
        id: competitor.id,
        value: metric.them(competitor, context),
      }))
      .filter(
        (entry): entry is { id: string; value: number } => entry.value !== null,
      );
    const winner = bestOf(entries, metric.better);
    return {
      metric: metric.metric,
      label: metric.label,
      better: metric.better,
      you: metric.you(context),
      median: median(entries.map((entry) => entry.value)),
      best: winner?.best ?? null,
      bestAppId: winner?.bestAppId ?? null,
    };
  });
  return { competitors: context.competitors.length, rows };
}
