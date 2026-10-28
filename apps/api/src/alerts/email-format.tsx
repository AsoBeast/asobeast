import type { AlertBatchPayload, AlertPayload } from '@asobeast/shared';
import type { ReactElement } from 'react';
import { renderEmail, type EmailContent } from '../mail/render-email';
import { AlertEmail } from './emails/alert-email';
import { alertFooterText, type AlertEmailContext } from './emails/alert-footer';
import { ReportEmail } from './emails/report-email';
import type { Stat } from './emails/stat-grid';
import type { AlertReport } from './report/report';
import { buildAlert } from './report/build-alert';
import {
  buildReport,
  DEFAULT_CAPS,
  reportCounts,
  type ReportCaps,
} from './report/build-report';
import { plural, type GranularPayload } from './report/report-sentences';
import { reportText } from './report/report-text';

const WITHOUT_LINKS: AlertEmailContext = { origin: null, unsubscribe: null };

export const HTML_BUDGET_BYTES = 90_000;

const HTML_TIERS: readonly ReportCaps[] = [
  DEFAULT_CAPS,
  { apps: 10, competitors: 10, rows: 10 },
  { apps: 10, competitors: 5, rows: 5 },
  { apps: 10, competitors: 3, rows: 3 },
  { apps: 10, competitors: 1, rows: 1 },
  { apps: 5, competitors: 1, rows: 1 },
  { apps: 3, competitors: 1, rows: 1 },
  { apps: 0, competitors: 0, rows: 0 },
];

const withFooter = (text: string, context: AlertEmailContext): string =>
  `${text}\n\n${alertFooterText(context)}`;

export function alertEmailElement(
  payload: GranularPayload,
  context: AlertEmailContext,
): ReactElement {
  return (
    <AlertEmail
      report={buildAlert(payload, context.origin, false)}
      context={context}
    />
  );
}

export async function formatEmail(
  payload: AlertPayload,
  context: AlertEmailContext = WITHOUT_LINKS,
): Promise<EmailContent> {
  if (payload.event === 'alerts.batch') {
    return formatBatchEmail(payload, context);
  }
  const report = buildAlert(payload, context.origin, false);
  return renderEmail(
    `[asobeast] ${report.headline}`,
    <AlertEmail report={report} context={context} />,
    withFooter(reportText(report), context),
  );
}

function ownedStats(payload: AlertBatchPayload): Stat[] {
  const counts = reportCounts(payload);
  const stats: Stat[] = [
    { label: 'Rank drops', value: counts.rankDrops, tone: 'down' },
    { label: 'Rank improvements', value: counts.rankImprovements, tone: 'up' },
    { label: 'Overtaken', value: counts.overtakes, tone: 'down' },
    { label: 'Milestones', value: counts.milestones, tone: 'neutral' },
    { label: 'First rankings', value: counts.firstRankings, tone: 'up' },
    { label: 'New in the top 10', value: counts.serpEntrants, tone: 'neutral' },
    { label: 'Listing changes', value: counts.changes, tone: 'neutral' },
    { label: 'Negative reviews', value: counts.negativeReviews, tone: 'down' },
    { label: 'New reviews', value: counts.newReviews, tone: 'neutral' },
    { label: 'New actions', value: counts.actions, tone: 'neutral' },
  ];
  return stats.filter((stat) => stat.value > 0);
}

function ownedSummary(payload: AlertBatchPayload): string {
  const counts = reportCounts(payload);
  return [
    plural(counts.rankDrops, 'rank drop'),
    plural(counts.rankImprovements, 'rank improvement'),
    plural(counts.serpEntrants, 'top 10 entrant'),
    plural(counts.changes, 'listing change'),
    plural(counts.negativeReviews, 'negative review'),
    plural(counts.newReviews, 'new review'),
    plural(counts.actions, 'new action'),
    plural(counts.milestones, 'milestone'),
    plural(counts.firstRankings, 'first ranking'),
    plural(counts.overtakes, 'overtake'),
  ].join(' · ');
}

function batchPreview(payload: AlertBatchPayload, report: AlertReport): string {
  return payload.scope === 'owned_apps'
    ? `Summary: ${ownedSummary(payload)}`
    : report.dateLabel;
}

function reportElement(
  payload: AlertBatchPayload,
  report: AlertReport,
  context: AlertEmailContext,
): ReactElement {
  return (
    <ReportEmail
      headline={report.headline}
      preview={batchPreview(payload, report)}
      stats={payload.scope === 'owned_apps' ? ownedStats(payload) : []}
      window={report.dateLabel}
      apps={report.apps}
      omittedApps={report.omittedApps}
      link={report.link}
      context={context}
    />
  );
}

export function batchEmailElement(
  payload: AlertBatchPayload,
  context: AlertEmailContext,
): ReactElement {
  return reportElement(payload, buildReport(payload, context.origin), context);
}

async function fittingReport(
  payload: AlertBatchPayload,
  context: AlertEmailContext,
  text: string,
  tier = 0,
): Promise<EmailContent> {
  const report = buildReport(payload, context.origin, HTML_TIERS[tier]);
  const email = await renderEmail(
    `[asobeast] ${report.headline}`,
    reportElement(payload, report, context),
    text,
  );
  const smallerTier = tier + 1 < HTML_TIERS.length;
  return smallerTier && Buffer.byteLength(email.html) > HTML_BUDGET_BYTES
    ? fittingReport(payload, context, text, tier + 1)
    : email;
}

export function formatBatchEmail(
  payload: AlertBatchPayload,
  context: AlertEmailContext = WITHOUT_LINKS,
): Promise<EmailContent> {
  const text = withFooter(
    reportText(buildReport(payload, context.origin)),
    context,
  );
  return fittingReport(payload, context, text);
}
