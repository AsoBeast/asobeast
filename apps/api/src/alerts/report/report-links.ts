import { appLink, webLink } from '../../mail/email-links';
import type { ReportGroupKind, ReportLink } from './report';

export interface ReportLinks {
  home: ReportLink | null;
  app: (appId: string) => ReportLink | null;
  group: (
    appId: string,
    kind: ReportGroupKind,
    total: number,
    scores?: readonly number[],
  ) => ReportLink | null;
  competitors: (appId: string, total: number) => ReportLink | null;
  action: (href: string | null) => ReportLink | null;
  reviews: (appId: string, score: number) => ReportLink | null;
}

const GROUP_PATHS: Record<ReportGroupKind, string> = {
  rankDrops: '/keywords',
  rankImprovements: '/keywords',
  milestones: '/keywords',
  firstRankings: '/keywords',
  overtakes: '/keywords',
  serpEntrants: '/rankings',
  changes: '/changes',
  negativeReviews: '/reviews',
  newReviews: '/reviews',
  actions: '/actions',
};

function singleScore(scores: readonly number[] | undefined): number | null {
  const unique = new Set(scores);
  return unique.size === 1 ? [...unique][0] : null;
}

function groupQuery(
  kind: ReportGroupKind,
  scores: readonly number[] | undefined,
): string {
  const score = singleScore(scores);
  if (kind === 'negativeReviews') {
    return score === null ? '?sort=lowest' : `?score=${score}`;
  }
  if (kind === 'newReviews' && score !== null) return `?score=${score}`;
  return '';
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
        `/apps/${appId}${GROUP_PATHS[kind]}${groupQuery(kind, scores)}`,
        `See all ${total} in AsoBeast`,
      ),
    competitors: (appId, total) =>
      page(`/apps/${appId}/competitors`, `See all ${total} competitors`),
    action: (href) => labelled(href, 'Open the action'),
    reviews: (appId, score) =>
      page(`/apps/${appId}/reviews?score=${score}`, 'Open reviews'),
  };
}
