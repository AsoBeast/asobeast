import type { AlertBatchAppSection, AlertBatchPayload } from '@asobeast/shared';
import {
  appHeader,
  appLabel,
  batchHeadline,
  changeLines,
  sectionBlocks,
  storeLabel,
} from './alert-summary';

export const BATCH_GROUP_CAP = 10;
export const COMPETITOR_CAP = 10;
export const DETAIL_LINE_CAP = 20;

export function windowLine(payload: AlertBatchPayload): string {
  return `Window (UTC): ${payload.window.from} → ${payload.window.to}`;
}

export function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function more(count: number, singular: string): string {
  return `+${count} more ${singular}${count === 1 ? '' : 's'}`;
}

export interface OwnedCounts {
  rankDrops: number;
  rankImprovements: number;
  serpEntrants: number;
  changes: number;
  negativeReviews: number;
  actions: number;
  rankMilestones: number;
  firstRankings: number;
  overtakes: number;
}

export function countOwned(payload: AlertBatchPayload): OwnedCounts {
  const counts: OwnedCounts = {
    rankDrops: 0,
    rankImprovements: 0,
    serpEntrants: 0,
    changes: 0,
    negativeReviews: 0,
    actions: 0,
    rankMilestones: 0,
    firstRankings: 0,
    overtakes: 0,
  };
  for (const section of payload.apps) {
    counts.rankDrops += section.rankDrops.length;
    counts.rankImprovements += section.rankImprovements.length;
    counts.serpEntrants += section.serpEntrants.length;
    counts.changes += section.changes.length;
    counts.negativeReviews += section.negativeReviews.length;
    counts.actions += section.actions.length;
    counts.rankMilestones += (section.rankMilestones ?? []).length;
    counts.firstRankings += (section.firstRankings ?? []).length;
    counts.overtakes += (section.overtakes ?? []).length;
  }
  return counts;
}

export function ownedSummary(payload: AlertBatchPayload): string {
  const counts = countOwned(payload);
  return [
    plural(counts.rankDrops, 'rank drop'),
    plural(counts.rankImprovements, 'rank improvement'),
    plural(counts.serpEntrants, 'SERP entrant'),
    plural(counts.changes, 'metadata change'),
    plural(counts.negativeReviews, 'negative review'),
    plural(counts.actions, 'new action'),
    plural(counts.rankMilestones, 'milestone'),
    plural(counts.firstRankings, 'first ranking'),
    plural(counts.overtakes, 'overtake'),
  ].join(' · ');
}

export function limitedLines(lines: string[], cap = DETAIL_LINE_CAP): string[] {
  const visible = lines.slice(0, cap);
  if (lines.length > visible.length) {
    visible.push(more(lines.length - visible.length, 'detail line'));
  }
  return visible;
}

export function ownedText(payload: AlertBatchPayload): string {
  const lines = [
    batchHeadline(payload),
    `Summary: ${ownedSummary(payload)}`,
    windowLine(payload),
    '',
  ];
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  for (const section of sections) {
    lines.push(appHeader(section));
    for (const block of sectionBlocks(section)) {
      lines.push(`  ${block.title}`);
      limitedLines(block.lines).forEach((line) => lines.push(`    ${line}`));
    }
    lines.push('');
  }
  if (payload.apps.length > sections.length) {
    lines.push(more(payload.apps.length - sections.length, 'app group'));
  }
  return lines.join('\n');
}

export function competitorLabel(
  competitor: AlertBatchAppSection['competitors'][number],
): string {
  return `${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)} · ${competitor.app.country.toUpperCase()}`;
}

export function competitorText(payload: AlertBatchPayload): string {
  const lines = [batchHeadline(payload), windowLine(payload), ''];
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  for (const section of sections) {
    lines.push(`Primary app · ${appHeader(section)}`);
    const competitors = section.competitors.slice(0, COMPETITOR_CAP);
    for (const competitor of competitors) {
      lines.push(`  Competitor · ${competitorLabel(competitor)}`);
      limitedLines(competitor.changes.flatMap(changeLines)).forEach((line) =>
        lines.push(`    ${line}`),
      );
    }
    if (section.competitors.length > competitors.length) {
      lines.push(
        `  ${more(section.competitors.length - competitors.length, 'competitor')}`,
      );
    }
    lines.push('');
  }
  if (payload.apps.length > sections.length) {
    lines.push(
      more(payload.apps.length - sections.length, 'primary app group'),
    );
  }
  return lines.join('\n');
}

export function legacyHeadline(payload: AlertBatchPayload): string {
  return `Daily alert update — ${plural(payload.totals.events, 'change')} across ${plural(payload.totals.apps, 'app')}`;
}

export function legacyBatchText(payload: AlertBatchPayload): string {
  const lines = [legacyHeadline(payload), windowLine(payload), ''];
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  for (const section of sections) {
    lines.push(appHeader(section));
    for (const block of sectionBlocks(section)) {
      lines.push(`  ${block.title}`);
      limitedLines(block.lines).forEach((line) => lines.push(`    ${line}`));
    }
    const competitors = section.competitors.slice(0, COMPETITOR_CAP);
    for (const competitor of competitors) {
      lines.push(`  Competitor · ${competitorLabel(competitor)}`);
      limitedLines(competitor.changes.flatMap(changeLines)).forEach((line) =>
        lines.push(`    ${line}`),
      );
    }
    if (section.competitors.length > competitors.length) {
      lines.push(
        `  ${more(section.competitors.length - competitors.length, 'competitor')}`,
      );
    }
    lines.push('');
  }
  if (payload.apps.length > sections.length) {
    lines.push(more(payload.apps.length - sections.length, 'app group'));
  }
  return lines.join('\n');
}
