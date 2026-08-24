import {
  ActionOpenedPayload,
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertPayload,
  MetadataChangedPayload,
  RANK_DEPTH,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
  SERP_DEPTH,
  SerpEntrantPayload,
  Store,
  formatRankPosition,
  isRanked,
  keywordLabel,
} from '@asobeast/shared';
import { actionScopeLine } from './action-lines';

const VALUE_MAX = 80;

export interface AlertBatchBlock {
  title: string;
  lines: string[];
}

export function position(value: number | null, depth = RANK_DEPTH): string {
  return isRanked(value) ? `#${value}` : `outside top ${depth}`;
}

export function storeLabel(store: Store): string {
  return store === 'GOOGLE_PLAY' ? 'Google Play' : 'App Store';
}

export function rank(value: number | null, depth?: number): string {
  return formatRankPosition(value, depth);
}

export function stars(score: number): string {
  return '★'.repeat(score) + '☆'.repeat(Math.max(0, 5 - score));
}

export function appLabel(name: string | null): string {
  return name ?? 'An app';
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function batchHeadline(payload: AlertBatchPayload): string {
  if (payload.scope === 'owned_apps') {
    return `Daily app update — ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'app')}`;
  }
  return `Competitor watch — ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'competitor')}`;
}

export function summarize(payload: AlertPayload): string {
  if (payload.event === 'metadata.changed') {
    const tag = payload.app.isCompetitor ? ' (competitor)' : '';
    const fields = payload.changes.map((change) => change.field).join(', ');
    return `${appLabel(payload.app.name)}${tag} changed ${fields}`;
  }

  if (payload.event === 'rank.dropped') {
    return `Rank drop: "${keywordLabel(payload.keyword)}" ${rank(payload.from, payload.fromDepth)} → ${rank(payload.to, payload.toDepth)}`;
  }

  if (payload.event === 'rank.improved') {
    return `Rank up: "${keywordLabel(payload.keyword)}" ${rank(payload.from, payload.fromDepth)} → ${rank(payload.to, payload.toDepth)}`;
  }

  if (payload.event === 'review.negative') {
    const version = payload.review.version
      ? ` (v${payload.review.version})`
      : '';
    return `${stars(payload.review.score)} review${version} for ${appLabel(payload.app.name)}`;
  }

  if (payload.event === 'serp.entrant') {
    const count = payload.entrants.length;
    return `${count} new entrant${count === 1 ? '' : 's'} in the top ${SERP_DEPTH} for "${keywordLabel(payload.keyword)}"`;
  }

  if (payload.event === 'alerts.batch') {
    return batchHeadline(payload);
  }

  if (payload.event === 'action.opened') {
    return actionLine(payload);
  }

  return `Weekly digest: ${payload.apps.length} app${payload.apps.length === 1 ? '' : 's'}`;
}

export function actionLine(payload: ActionOpenedPayload): string {
  const verb = payload.action.reopened ? 'reopened' : 'opened';
  return `[${payload.action.priority}] ${payload.action.rule} ${verb} for ${appLabel(payload.app.name)} — estimated impact ${payload.action.impact}`;
}

export function actionLines(payload: ActionOpenedPayload): string[] {
  const lines = [actionLine(payload), `  ${actionScopeLine(payload)}`];
  if (payload.link) lines.push(`  ${payload.link}`);
  return lines;
}

export function truncateValue(raw: string | null): string {
  const value = raw ?? '—';
  return value.length > VALUE_MAX ? `${value.slice(0, VALUE_MAX - 1)}…` : value;
}

export function rankLine(
  alert: RankDroppedPayload | RankImprovedPayload,
): string {
  const arrow = alert.event === 'rank.dropped' ? '▼' : '▲';
  return `${keywordLabel(alert.keyword)}  ${rank(alert.from, alert.fromDepth)} → ${rank(alert.to, alert.toDepth)} ${arrow}`;
}

export function entrantLines(entrant: SerpEntrantPayload): string[] {
  return entrant.entrants.map((item) => `#${item.position} · ${item.title}`);
}

export function changeLines(change: MetadataChangedPayload): string[] {
  return change.changes.map(
    (field) =>
      `${field.field}: ${truncateValue(field.before)} → ${truncateValue(field.after)}`,
  );
}

export function reviewLine(review: ReviewNegativePayload): string {
  const version = review.review.version ? ` — v${review.review.version}` : '';
  return `${stars(review.review.score)} "${truncateValue(review.review.text)}"${version}`;
}

export function appHeader(section: AlertBatchAppSection): string {
  return `${appLabel(section.app.name)} · ${storeLabel(section.app.store)} · ${section.app.country.toUpperCase()}`;
}

export function sectionBlocks(
  section: AlertBatchAppSection,
): AlertBatchBlock[] {
  const blocks: AlertBatchBlock[] = [];
  if (section.rankDrops.length > 0) {
    blocks.push({
      title: 'Rank drops',
      lines: section.rankDrops.map(rankLine),
    });
  }
  if (section.rankImprovements.length > 0) {
    blocks.push({
      title: 'Rank improvements',
      lines: section.rankImprovements.map(rankLine),
    });
  }
  if (section.serpEntrants.length > 0) {
    blocks.push({
      title: 'New entrants',
      lines: section.serpEntrants.flatMap(entrantLines),
    });
  }
  if (section.changes.length > 0) {
    blocks.push({
      title: 'Metadata changes',
      lines: section.changes.flatMap(changeLines),
    });
  }
  if (section.negativeReviews.length > 0) {
    blocks.push({
      title: 'Negative reviews',
      lines: section.negativeReviews.map(reviewLine),
    });
  }
  if (section.actions.length > 0) {
    blocks.push({
      title: 'Actions',
      lines: section.actions.flatMap(actionLines),
    });
  }
  return blocks;
}

export function competitorBlocks(
  section: AlertBatchAppSection,
): AlertBatchBlock[] {
  return section.competitors
    .filter((competitor) => competitor.changes.length > 0)
    .map((competitor) => ({
      title: `Competitor · ${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)}`,
      lines: competitor.changes.flatMap(changeLines),
    }));
}
