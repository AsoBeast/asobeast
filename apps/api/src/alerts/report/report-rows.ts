import {
  ACTION_RULE_TITLES,
  CHANGE_FIELD_LABELS,
  countChars,
  isRanked,
  truncateChars,
  type ActionOpenedPayload,
  type ActionPriority,
  type ChangeField,
  type MetadataChangedPayload,
  type RankDroppedPayload,
  type RankFirstPayload,
  type RankImprovedPayload,
  type RankMilestoneDirection,
  type RankMilestonePayload,
  type RankMilestoneTier,
  type RankOvertakenPayload,
  type ReviewNegativePayload,
  type SerpEntrantPayload,
} from '@asobeast/shared';
import { actionScopeLine } from '../action-lines';
import type { ReportRow } from './report';

const VALUE_MAX = 80;
export const EMPTY_VALUE = '—';
const NO_REVIEW_TEXT = 'no written review';

const QUOTED_FIELDS: ReadonlySet<ChangeField> = new Set([
  'title',
  'subtitle',
  'summary',
  'description',
  'whatsNew',
  'screenshotCaptions',
]);

export const PRIORITY_WORDS: Record<ActionPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface KeywordText {
  text: string;
  country?: string;
}

export function rankCell(position: number | null, depth: number): string {
  return isRanked(position) ? `#${position}` : `>${depth}`;
}

export function keywordCell(
  keyword: KeywordText,
  appCountry: string | null,
): string {
  const { text, country } = keyword;
  if (!country) return text;
  return appCountry?.toLowerCase() === country.toLowerCase()
    ? text
    : `${text} (${country.toUpperCase()})`;
}

export function clip(value: string | null): string {
  if (value === null) return EMPTY_VALUE;
  const text = value.replace(/\s+/g, ' ').trim();
  return countChars(text) > VALUE_MAX
    ? `${truncateChars(text, VALUE_MAX - 1)}…`
    : text;
}

export function stars(score: number): string {
  return '★'.repeat(score) + '☆'.repeat(Math.max(0, 5 - score));
}

export function reviewQuote(text: string): string {
  return text.trim().length > 0 ? `"${clip(text)}"` : NO_REVIEW_TEXT;
}

export function milestonePhrase(
  tier: RankMilestoneTier,
  direction: RankMilestoneDirection,
): string {
  if (tier === 1) {
    return direction === 'entered' ? 'reached first place' : 'lost first place';
  }
  return direction === 'entered'
    ? `entered the top ${tier}`
    : `left the top ${tier}`;
}

export function rankRow(
  alert: RankDroppedPayload | RankImprovedPayload,
  appCountry: string | null,
): ReportRow {
  return {
    kind: 'move',
    label: keywordCell(alert.keyword, appCountry),
    from: rankCell(alert.from, alert.fromDepth),
    to: rankCell(alert.to, alert.toDepth),
    note: null,
  };
}

export function milestoneRow(
  alert: RankMilestonePayload,
  appCountry: string | null,
): ReportRow {
  return {
    kind: 'move',
    label: keywordCell(alert.keyword, appCountry),
    from: rankCell(alert.from, alert.fromDepth),
    to: rankCell(alert.to, alert.toDepth),
    note: milestonePhrase(alert.tier, alert.direction),
  };
}

const textRow = (text: string, detail: string | null = null): ReportRow => ({
  kind: 'text',
  text,
  detail,
});

export function firstRankingRow(
  alert: RankFirstPayload,
  appCountry: string | null,
): ReportRow {
  return textRow(
    `${keywordCell(alert.keyword, appCountry)}  ${rankCell(alert.position, alert.depth)}`,
  );
}

export function overtakeRow(
  alert: RankOvertakenPayload,
  appCountry: string | null,
): ReportRow {
  const rival = alert.competitor;
  const moves = [
    `${rival.name ?? 'A competitor'} ${rankCell(rival.from, alert.fromDepth)} → ${rankCell(rival.to, alert.toDepth)}`,
    `you ${rankCell(alert.from, alert.fromDepth)} → ${rankCell(alert.to, alert.toDepth)}`,
  ];
  return textRow(
    `${keywordCell(alert.keyword, appCountry)} · ${moves.join(', ')}`,
  );
}

export function entrantRows(
  alert: SerpEntrantPayload,
  appCountry: string | null,
): ReportRow[] {
  const keyword = keywordCell(alert.keyword, appCountry);
  return alert.entrants.map((entrant) =>
    textRow(
      `${keyword} · #${entrant.position} ${entrant.title}${entrant.isCompetitor ? ' (competitor)' : ''}`,
    ),
  );
}

function changeValue(field: ChangeField, value: string | null): string {
  if (value === null) return EMPTY_VALUE;
  return QUOTED_FIELDS.has(field) ? `"${clip(value)}"` : clip(value);
}

export function changeRows(alert: MetadataChangedPayload): ReportRow[] {
  return alert.changes.map(({ field, before, after }): ReportRow => {
    if (field === 'icon') {
      return {
        kind: 'image',
        field: 'Icon changed',
        beforeUrl: before,
        afterUrl: after,
      };
    }
    if (field === 'screenshotImages') {
      return textRow('Screenshots replaced or reordered');
    }
    return {
      kind: 'change',
      field: CHANGE_FIELD_LABELS[field],
      before: changeValue(field, before),
      after: changeValue(field, after),
    };
  });
}

export function reviewRow(alert: ReviewNegativePayload): ReportRow {
  const { score, text, version } = alert.review;
  const parts = [`${stars(score)} ${reviewQuote(text)}`];
  if (version) parts.push(`v${version}`);
  return textRow(parts.join(' · '));
}

export function actionRow(alert: ActionOpenedPayload): ReportRow {
  const { priority, rule, impact, reopened } = alert.action;
  const parts = [
    PRIORITY_WORDS[priority],
    ACTION_RULE_TITLES[rule],
    `impact ${impact}`,
  ];
  if (reopened) parts.push('reopened');
  return textRow(parts.join(' · '), actionScopeLine(alert));
}
