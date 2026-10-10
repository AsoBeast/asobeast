import {
  AlertBatchPayload,
  AlertPayload,
  keywordLabel,
} from '@asobeast/shared';
import type { Fact } from '../mail/fact-table';
import { summarizeActionEvidence } from './action-lines';
import {
  appLabel,
  isRankEvent,
  milestonePhrase,
  rank,
  RankEventPayload,
  reviewBody,
  stars,
} from './alert-summary';

const DIGEST_APP_CAP = 10;

function value(raw: string | null): string {
  return raw ?? '—';
}

function signedDelta(delta: number | null): string {
  if (delta === null) {
    return '—';
  }
  const rounded = Math.round(delta * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function rankEventRows(payload: RankEventPayload): Fact[] {
  const rows: Fact[] = [
    ['App', appLabel(payload.app.name)],
    ['Keyword', keywordLabel(payload.keyword)],
  ];
  if (payload.event === 'rank.first') {
    return [...rows, ['Position', rank(payload.position, payload.depth)]];
  }
  if (payload.event === 'rank.milestone') {
    return [
      ...rows,
      ['Milestone', milestonePhrase(payload.tier, payload.direction)],
      ['From', rank(payload.from, payload.fromDepth)],
      ['To', rank(payload.to, payload.toDepth)],
    ];
  }
  return [
    ...rows,
    ['Competitor', appLabel(payload.competitor.name)],
    [
      'Competitor position',
      `${rank(payload.competitor.from, payload.fromDepth)} → ${rank(payload.competitor.to, payload.toDepth)}`,
    ],
    [
      'App position',
      `${rank(payload.from, payload.fromDepth)} → ${rank(payload.to, payload.toDepth)}`,
    ],
  ];
}

export function detailRows(
  payload: Exclude<AlertPayload, AlertBatchPayload>,
): Fact[] {
  if (payload.event === 'metadata.changed') {
    const rows: Fact[] = [
      ['App', appLabel(payload.app.name)],
      ['Type', payload.app.isCompetitor ? 'Competitor' : 'Primary'],
    ];
    payload.changes.forEach((change) => {
      rows.push([
        change.field,
        `${value(change.before)} → ${value(change.after)}`,
      ]);
    });
    return rows;
  }

  if (payload.event === 'rank.dropped' || payload.event === 'rank.improved') {
    return [
      ['App', appLabel(payload.app.name)],
      ['Keyword', keywordLabel(payload.keyword)],
      ['From', rank(payload.from, payload.fromDepth)],
      ['To', rank(payload.to, payload.toDepth)],
      ['Threshold', `${payload.threshold}`],
    ];
  }

  if (payload.event === 'review.negative') {
    return [
      ['App', appLabel(payload.app.name)],
      ['Rating', stars(payload.review.score)],
      ['Version', value(payload.review.version)],
      ['Title', value(payload.review.title)],
      ['Review', reviewBody(payload.review.text)],
    ];
  }

  if (payload.event === 'serp.entrant') {
    return [
      ['Keyword', keywordLabel(payload.keyword)],
      ['Date', payload.date],
      ...payload.entrants.map((entrant): Fact => [
        `#${entrant.position}`,
        entrant.isCompetitor ? `${entrant.title} (competitor)` : entrant.title,
      ]),
    ];
  }

  if (payload.event === 'action.opened') {
    const rows: Fact[] = [
      ['App', appLabel(payload.app.name)],
      ['Rule', payload.action.rule],
      ['Priority', payload.action.priority],
      ['Estimated impact', `${payload.action.impact}`],
      ['Evidence', summarizeActionEvidence(payload.evidence)],
    ];
    if (payload.keyword) {
      rows.push([
        'Keyword',
        keywordLabel({
          text: payload.keyword.text,
          country: payload.app.country,
        }),
      ]);
    }
    return rows;
  }

  if (isRankEvent(payload)) {
    return rankEventRows(payload);
  }

  const rows: Fact[] = [
    ['Window', `${payload.window.from} → ${payload.window.to}`],
  ];
  if (payload.groups.length > 0) {
    rows.push(['', 'Linked apps']);
    payload.groups.forEach((group) => {
      rows.push([
        group.name,
        `vis ${Math.round(group.visibility.current)} (${signedDelta(group.visibility.delta7d)})`,
      ]);
    });
  }
  payload.apps.slice(0, DIGEST_APP_CAP).forEach((app) => {
    const cells = [
      `vis ${Math.round(app.visibility.current)} (${signedDelta(app.visibility.delta7d)})`,
    ];
    if (app.audit && app.audit.current !== null) {
      cells.push(
        `Audit ${Math.round(app.audit.current)} (${signedDelta(app.audit.delta7d)})`,
      );
    }
    if (app.actions) {
      cells.push(
        `Actions ${app.actions.open} open (${app.actions.critical} critical, ${app.actions.high} high)`,
      );
    }
    rows.push([appLabel(app.name), cells.join(' · ')]);
  });
  if (payload.apps.length > DIGEST_APP_CAP) {
    rows.push(['', `+${payload.apps.length - DIGEST_APP_CAP} more`]);
  }
  return rows;
}
