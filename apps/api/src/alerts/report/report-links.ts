import {
  chartColumnsPath,
  chartTablePath,
  type ChartMoveScope,
} from '@asobeast/shared';
import { appLink, webLink } from '../../mail/email-links';
import type { ReportGroupKind, ReportLink } from './report';

export type AppPageGroupKind = Exclude<ReportGroupKind, 'chartMoves'>;

export interface ReportLinks {
  home: ReportLink | null;
  app: (appId: string) => ReportLink | null;
  group: (
    appId: string,
    kind: AppPageGroupKind,
    total: number,
    scores?: readonly number[],
  ) => ReportLink | null;
  charts: (chart: ChartMoveScope | null, total: number) => ReportLink | null;
  chart: (chart: ChartMoveScope, date: string) => ReportLink | null;
  competitors: (appId: string, total: number) => ReportLink | null;
  action: (href: string | null) => ReportLink | null;
}

const GROUP_PATHS: Record<AppPageGroupKind, string> = {
  rankDrops: '/keywords',
  rankImprovements: '/keywords',
  milestones: '/keywords',
  firstRankings: '/keywords',
  overtakes: '/keywords',
  serpEntrants: '/rankings',
  changes: '/changes',
  negativeReviews: '/reviews',
  actions: '/actions',
};

function reviewsQuery(scores: readonly number[] | undefined): string {
  const unique = new Set(scores);
  return unique.size === 1 ? `?score=${[...unique][0]}` : '?sort=lowest';
}

const labelled = (href: string | null, label: string): ReportLink | null =>
  href ? { href, label } : null;

export function reportLinks(origin: string | null): ReportLinks {
  const page = (path: string, label: string) =>
    labelled(webLink(origin, path), label);
  return {
    home: page('/', 'Open AsoBeast'),
    app: (appId) => labelled(appLink(origin, appId), 'Open app'),
    group: (appId, kind, total, scores) =>
      page(
        `/apps/${appId}${GROUP_PATHS[kind]}${kind === 'negativeReviews' ? reviewsQuery(scores) : ''}`,
        `See all ${total} in AsoBeast`,
      ),
    charts: (chart, total) =>
      chart
        ? page(chartColumnsPath(chart), `See all ${total} in AsoBeast`)
        : null,
    chart: (chart, date) =>
      page(chartTablePath(chart, { date }), 'Open the chart'),
    competitors: (appId, total) =>
      page(`/apps/${appId}/competitors`, `See all ${total} competitors`),
    action: (href) => labelled(href, 'Open the action'),
  };
}
