import {
  ACTION_RULE_TITLES,
  CHANGE_FIELD_LABELS,
  formatUtcDate,
  formatUtcDateRange,
  keywordLabel,
  type ChartMovePayload,
  type DigestWeeklyPayload,
  type MetadataChangedPayload,
  type RankMilestonePayload,
  type RankOvertakenPayload,
  type RankFirstPayload,
} from '@asobeast/shared';
import { summarizeActionEvidence } from '../action-lines';
import type { ReportFact, ReportRow } from './report';
import { chartLabel } from './report-chart-moves';
import {
  EMPTY_VALUE,
  PRIORITY_WORDS,
  changeRows,
  milestonePhrase,
  rankCell,
  stars,
} from './report-rows';
import { appName, plural, type GranularPayload } from './report-sentences';

const DIGEST_APP_CAP = 10;

const fact = (label: string, value: string): ReportFact => ({ label, value });

function changeValue(row: ReportRow): string {
  switch (row.kind) {
    case 'change':
      return `${row.before} → ${row.after}`;
    case 'move':
      return `${row.from} → ${row.to}`;
    case 'image':
      return 'Changed';
    case 'text':
      return 'Replaced or reordered';
  }
}

function changeFacts(alert: MetadataChangedPayload): ReportFact[] {
  const rows = changeRows(alert);
  return [
    fact('Type', alert.app.isCompetitor ? 'Competitor' : 'Your app'),
    ...alert.changes.map((change, index) =>
      fact(CHANGE_FIELD_LABELS[change.field], changeValue(rows[index])),
    ),
  ];
}

function signedDelta(delta: number | null): string {
  if (delta === null) return EMPTY_VALUE;
  const rounded = Math.round(delta * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

const visibility = (trend: { current: number; delta7d: number | null }) =>
  `vis ${Math.round(trend.current)} (${signedDelta(trend.delta7d)})`;

function digestAppValue(app: DigestWeeklyPayload['apps'][number]): string {
  const parts = [visibility(app.visibility)];
  const [up] = app.moversUp;
  if (up) {
    parts.push(
      `↑ ${up.text} ${rankCell(up.from, up.fromDepth)} → ${rankCell(up.to, up.toDepth)}`,
    );
  }
  const [down] = app.moversDown;
  if (down) {
    parts.push(
      `↓ ${down.text} ${rankCell(down.from, down.fromDepth)} → ${rankCell(down.to, down.toDepth)}`,
    );
  }
  parts.push(plural(app.changes, 'change'));
  if (app.audit && app.audit.current !== null) {
    parts.push(
      `Audit ${Math.round(app.audit.current)} (${signedDelta(app.audit.delta7d)})`,
    );
  }
  if (app.actions) {
    parts.push(
      `Actions ${app.actions.open} open (${app.actions.critical} critical, ${app.actions.high} high)`,
    );
  }
  return parts.join(' · ');
}

function digestFacts(alert: DigestWeeklyPayload): ReportFact[] {
  const facts = [
    fact('Window', formatUtcDateRange(alert.window.from, alert.window.to)),
  ];
  if (alert.groups.length > 0) {
    facts.push(fact('', 'Linked apps'));
    alert.groups.forEach((group) =>
      facts.push(fact(group.name, visibility(group.visibility))),
    );
  }
  alert.apps
    .slice(0, DIGEST_APP_CAP)
    .forEach((app) => facts.push(fact(appName(app.name), digestAppValue(app))));
  if (alert.apps.length > DIGEST_APP_CAP) {
    facts.push(fact('', `+${alert.apps.length - DIGEST_APP_CAP} more`));
  }
  return facts;
}

function chartMoveFacts(alert: ChartMovePayload): ReportFact[] {
  return [
    fact('Chart', chartLabel(alert.chart)),
    ...(alert.event === 'chart.milestone'
      ? [fact('Milestone', milestonePhrase(alert.tier, alert.direction))]
      : []),
    fact('From', rankCell(alert.from, alert.depth)),
    fact('To', rankCell(alert.to, alert.depth)),
    fact('Date', formatUtcDate(alert.date)),
  ];
}

function rankEventFacts(
  alert: RankMilestonePayload | RankFirstPayload | RankOvertakenPayload,
): ReportFact[] {
  const keyword = fact('Keyword', keywordLabel(alert.keyword));
  if (alert.event === 'rank.first') {
    return [keyword, fact('Position', rankCell(alert.position, alert.depth))];
  }
  if (alert.event === 'rank.milestone') {
    return [
      keyword,
      fact('Milestone', milestonePhrase(alert.tier, alert.direction)),
      fact('From', rankCell(alert.from, alert.fromDepth)),
      fact('To', rankCell(alert.to, alert.toDepth)),
    ];
  }
  return [
    keyword,
    fact('Competitor', appName(alert.competitor.name)),
    fact(
      'Competitor position',
      `${rankCell(alert.competitor.from, alert.fromDepth)} → ${rankCell(alert.competitor.to, alert.toDepth)}`,
    ),
    fact(
      'Your position',
      `${rankCell(alert.from, alert.fromDepth)} → ${rankCell(alert.to, alert.toDepth)}`,
    ),
  ];
}

export function factsOf(payload: GranularPayload): ReportFact[] {
  switch (payload.event) {
    case 'metadata.changed':
      return changeFacts(payload);
    case 'rank.dropped':
    case 'rank.improved':
      return [
        fact('Keyword', keywordLabel(payload.keyword)),
        fact('From', rankCell(payload.from, payload.fromDepth)),
        fact('To', rankCell(payload.to, payload.toDepth)),
        fact('Alert threshold', `${payload.threshold}`),
      ];
    case 'review.negative':
      return [
        fact('Rating', stars(payload.review.score)),
        fact('Version', payload.review.version ?? EMPTY_VALUE),
        fact('Title', payload.review.title ?? EMPTY_VALUE),
        fact(
          'Review',
          payload.review.text.trim()
            ? payload.review.text
            : 'no written review',
        ),
      ];
    case 'serp.entrant':
      return [
        fact('Keyword', keywordLabel(payload.keyword)),
        fact('Date', formatUtcDate(payload.date)),
        ...payload.entrants.map((entrant) =>
          fact(
            `#${entrant.position}`,
            entrant.isCompetitor
              ? `${entrant.title} (competitor)`
              : entrant.title,
          ),
        ),
      ];
    case 'action.opened':
      return [
        fact('Rule', ACTION_RULE_TITLES[payload.action.rule]),
        fact('Priority', PRIORITY_WORDS[payload.action.priority]),
        fact('Impact', `${payload.action.impact}`),
        fact('Evidence', summarizeActionEvidence(payload.evidence)),
        ...(payload.keyword
          ? [
              fact(
                'Keyword',
                keywordLabel({
                  text: payload.keyword.text,
                  country: payload.app.country,
                }),
              ),
            ]
          : []),
      ];
    case 'digest.weekly':
      return digestFacts(payload);
    case 'chart.entered':
    case 'chart.left':
    case 'chart.milestone':
      return chartMoveFacts(payload);
    default:
      return rankEventFacts(payload);
  }
}
