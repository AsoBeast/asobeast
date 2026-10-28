import {
  ACTION_RULE_TITLES,
  CHANGE_FIELD_LABELS,
  SERP_DEPTH,
  formatUtcDateRange,
  isRanked,
  type ActionOpenedPayload,
  type AlertBatchPayload,
  type AlertPayload,
  type MetadataChangedPayload,
  type RankDroppedPayload,
  type RankMilestonePayload,
  type RankOvertakenPayload,
  type SerpEntrantPayload,
} from '@asobeast/shared';
import {
  PRIORITY_WORDS,
  milestonePhrase,
  reviewAuthor,
  reviewQuote,
  reviewTone,
  type ReviewAlert,
} from './report-rows';
import { storefrontLabel } from './storefront';

export type GranularPayload = Exclude<AlertPayload, AlertBatchPayload>;

export interface Sentence {
  emoji: string;
  text: string;
}

export function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function listPhrase(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export const appName = (name: string | null | undefined): string =>
  name ?? 'An app';

function rankWord(position: number | null, depth: number): string {
  return isRanked(position) ? `#${position}` : `outside the top ${depth}`;
}

function keywordIn(
  keyword: { text: string; country?: string },
  withFlag: boolean,
): string {
  const market = storefrontLabel(keyword.country ?? null, withFlag);
  return market ? `"${keyword.text}" in ${market}` : `"${keyword.text}"`;
}

function dropSentence(alert: RankDroppedPayload, withFlag: boolean): string {
  const keyword = keywordIn(alert.keyword, withFlag);
  const app = appName(alert.app.name);
  return isRanked(alert.to)
    ? `${app} dropped from ${rankWord(alert.from, alert.fromDepth)} to #${alert.to} for ${keyword}`
    : `${app} fell out of the top ${alert.toDepth} for ${keyword}, from ${rankWord(alert.from, alert.fromDepth)}`;
}

function milestoneEmoji(alert: RankMilestonePayload): string {
  if (alert.direction === 'left') return '🔻';
  return alert.tier === 1 ? '🏆' : '🏅';
}

function overtakeSentence(
  alert: RankOvertakenPayload,
  withFlag: boolean,
): string {
  const app = appName(alert.app.name);
  const rival = appName(alert.competitor.name);
  return `${rival} overtook ${app} for ${keywordIn(alert.keyword, withFlag)}: ${rival} ${rankWord(alert.competitor.from, alert.fromDepth)} → ${rankWord(alert.competitor.to, alert.toDepth)}, ${app} ${rankWord(alert.from, alert.fromDepth)} → ${rankWord(alert.to, alert.toDepth)}`;
}

const lowerFirst = (text: string): string =>
  `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

function changeSentence(alert: MetadataChangedPayload): string {
  const fields = [
    ...new Set(
      alert.changes.map((change) =>
        lowerFirst(CHANGE_FIELD_LABELS[change.field]),
      ),
    ),
  ];
  const who = alert.app.isCompetitor
    ? `${appName(alert.app.name)}, a competitor,`
    : appName(alert.app.name);
  return `${who} changed its ${listPhrase(fields)}`;
}

function reviewSentence(alert: ReviewAlert): string {
  const author = reviewAuthor(alert);
  const from = author ? ` from ${author}` : '';
  const version = alert.review.version ? `, v${alert.review.version}` : '';
  return `A ${alert.review.score} star review of ${appName(alert.app.name)}${from}${version}: ${reviewQuote(alert.review.text)}`;
}

const reviewEmoji = (score: number): string =>
  reviewTone(score) === 'down' ? '⚠️' : '⭐';

function entrantSentence(alert: SerpEntrantPayload, withFlag: boolean): string {
  const names = alert.entrants
    .map((entrant) => `#${entrant.position} ${entrant.title}`)
    .join(', ');
  return `New in the top ${SERP_DEPTH} for ${keywordIn(alert.keyword, withFlag)}: ${names}`;
}

function actionSentence(alert: ActionOpenedPayload): string {
  const { priority, rule, impact, reopened } = alert.action;
  const kind = reopened ? 'action reopened' : 'action';
  return `${PRIORITY_WORDS[priority]} priority ${kind} for ${appName(alert.app.name)}: ${ACTION_RULE_TITLES[rule]} (impact ${impact})`;
}

export function sentenceOf(
  payload: GranularPayload,
  withFlag: boolean,
): Sentence {
  switch (payload.event) {
    case 'rank.dropped':
      return { emoji: '📉', text: dropSentence(payload, withFlag) };
    case 'rank.improved':
      return {
        emoji: '📈',
        text: `${appName(payload.app.name)} climbed from ${rankWord(payload.from, payload.fromDepth)} to ${rankWord(payload.to, payload.toDepth)} for ${keywordIn(payload.keyword, withFlag)}`,
      };
    case 'rank.milestone':
      return {
        emoji: milestoneEmoji(payload),
        text: `${appName(payload.app.name)} ${milestonePhrase(payload.tier, payload.direction)} for ${keywordIn(payload.keyword, withFlag)}: ${rankWord(payload.from, payload.fromDepth)} → ${rankWord(payload.to, payload.toDepth)}`,
      };
    case 'rank.first':
      return {
        emoji: '✨',
        text: `${appName(payload.app.name)} ranks for ${keywordIn(payload.keyword, withFlag)} for the first time, at ${rankWord(payload.position, payload.depth)}`,
      };
    case 'rank.overtaken':
      return { emoji: '⚔️', text: overtakeSentence(payload, withFlag) };
    case 'metadata.changed':
      return { emoji: '📝', text: changeSentence(payload) };
    case 'review.negative':
      return { emoji: '⚠️', text: reviewSentence(payload) };
    case 'review.new':
      return {
        emoji: reviewEmoji(payload.review.score),
        text: reviewSentence(payload),
      };
    case 'serp.entrant':
      return { emoji: '🆕', text: entrantSentence(payload, withFlag) };
    case 'action.opened':
      return { emoji: '🎯', text: actionSentence(payload) };
    case 'digest.weekly':
      return {
        emoji: '🗓️',
        text: `Weekly digest: ${plural(payload.apps.length, 'app')}, ${formatUtcDateRange(payload.window.from, payload.window.to)}`,
      };
    default: {
      const never: never = payload;
      return never;
    }
  }
}
