import type {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertPayload,
} from '@asobeast/shared';
import type { ReactElement } from 'react';
import { appLink, webLink } from '../mail/email-links';
import { renderEmail, type EmailContent } from '../mail/render-email';
import { detailRows } from './alert-detail-rows';
import {
  appHeader,
  batchHeadline,
  changeLines,
  sectionBlocks,
  summarize,
} from './alert-summary';
import { AlertEmail, type AlertAction } from './emails/alert-email';
import type { AlertEmailContext } from './emails/alert-footer';
import type { ReportCardModel } from './emails/report-card';
import { ReportEmail } from './emails/report-email';
import type { Stat } from './emails/stat-grid';
import {
  BATCH_GROUP_CAP,
  COMPETITOR_CAP,
  competitorLabel,
  competitorText,
  countOwned,
  DETAIL_LINE_CAP,
  legacyBatchText,
  legacyHeadline,
  limitedLines,
  more,
  ownedSummary,
  ownedText,
  windowLine,
} from './email-text-parts';

const WITHOUT_LINKS: AlertEmailContext = { origin: null, unsubscribe: null };

export const HTML_BUDGET_BYTES = 90_000;

const HTML_DETAIL_CAPS = [DETAIL_LINE_CAP, 10, 5, 3, 1] as const;

function alertAction(
  payload: Exclude<AlertPayload, AlertBatchPayload>,
  origin: string | null,
): AlertAction | null {
  if (payload.event === 'action.opened') {
    return payload.link
      ? { href: payload.link, label: 'Open the action' }
      : null;
  }
  if (payload.event === 'digest.weekly') {
    const portfolio = webLink(origin, '/');
    return portfolio ? { href: portfolio, label: 'Open the portfolio' } : null;
  }
  const href = 'app' in payload ? appLink(origin, payload.app.id) : null;
  return href ? { href, label: 'Open in AsoBeast' } : null;
}

export function alertEmailElement(
  payload: Exclude<AlertPayload, AlertBatchPayload>,
  context: AlertEmailContext,
): ReactElement {
  return (
    <AlertEmail
      summary={summarize(payload)}
      facts={detailRows(payload).filter(([label]) => label !== 'Open')}
      action={alertAction(payload, context.origin)}
      occurredAt={payload.occurredAt}
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
  const summary = summarize(payload);
  const text = [
    summary,
    '',
    ...detailRows(payload).map(([label, cell]) =>
      label ? `${label}: ${cell}` : cell,
    ),
    '',
    `Occurred at ${payload.occurredAt}`,
  ].join('\n');

  return renderEmail(
    `[asobeast] ${summary}`,
    alertEmailElement(payload, context),
    text,
  );
}

type CompetitorSection = AlertBatchAppSection['competitors'][number];

interface BatchReport {
  headline: string;
  preview: string;
  stats: Stat[];
  cards: (detailCap: number) => ReportCardModel[];
  notes: string[];
  text: string;
}

function ownedStats(payload: AlertBatchPayload): Stat[] {
  const counts = countOwned(payload);
  const stats: Stat[] = [
    { label: 'Rank drops', value: counts.rankDrops, tone: 'down' },
    { label: 'Rank improvements', value: counts.rankImprovements, tone: 'up' },
    { label: 'Overtaken', value: counts.overtakes, tone: 'down' },
    { label: 'Milestones', value: counts.rankMilestones, tone: 'neutral' },
    { label: 'First rankings', value: counts.firstRankings, tone: 'up' },
    { label: 'New entrants', value: counts.serpEntrants, tone: 'neutral' },
    { label: 'Metadata changes', value: counts.changes, tone: 'neutral' },
    { label: 'Negative reviews', value: counts.negativeReviews, tone: 'down' },
    { label: 'New actions', value: counts.actions, tone: 'neutral' },
  ];
  return stats.filter((stat) => stat.value > 0);
}

function overflow(count: number, singular: string): string[] {
  return count > 0 ? [more(count, singular)] : [];
}

function competitorCard(
  competitor: CompetitorSection,
  detailCap: number,
): ReportCardModel {
  return {
    title: `Competitor · ${competitorLabel(competitor)}`,
    href: null,
    blocks: [
      {
        title: '',
        lines: limitedLines(competitor.changes.flatMap(changeLines), detailCap),
      },
    ],
    children: [],
    notes: [],
  };
}

function appCard(
  title: string,
  section: AlertBatchAppSection,
  origin: string | null,
): ReportCardModel {
  return {
    title,
    href: appLink(origin, section.app.id),
    blocks: [],
    children: [],
    notes: [],
  };
}

function withOwnedBlocks(
  card: ReportCardModel,
  section: AlertBatchAppSection,
  detailCap: number,
): ReportCardModel {
  return {
    ...card,
    blocks: sectionBlocks(section).map((block) => ({
      title: block.title,
      lines: limitedLines(block.lines, detailCap),
    })),
  };
}

function withCompetitors(
  card: ReportCardModel,
  section: AlertBatchAppSection,
  detailCap: number,
): ReportCardModel {
  const competitors = section.competitors.slice(
    0,
    Math.min(COMPETITOR_CAP, detailCap),
  );
  return {
    ...card,
    children: competitors.map((competitor) =>
      competitorCard(competitor, detailCap),
    ),
    notes: overflow(
      section.competitors.length - competitors.length,
      'competitor',
    ),
  };
}

function batchReport(
  payload: AlertBatchPayload,
  origin: string | null,
): BatchReport {
  const sections = payload.apps.slice(0, BATCH_GROUP_CAP);
  const omitted = payload.apps.length - sections.length;
  const ownedCard = (section: AlertBatchAppSection, detailCap: number) =>
    withOwnedBlocks(
      appCard(appHeader(section), section, origin),
      section,
      detailCap,
    );
  if (payload.scope === 'owned_apps') {
    return {
      headline: batchHeadline(payload),
      preview: `Summary: ${ownedSummary(payload)}`,
      stats: ownedStats(payload),
      cards: (detailCap) =>
        sections.map((section) => ownedCard(section, detailCap)),
      notes: overflow(omitted, 'app group'),
      text: ownedText(payload),
    };
  }
  if (payload.scope === 'competitors') {
    return {
      headline: batchHeadline(payload),
      preview: windowLine(payload),
      stats: [],
      cards: (detailCap) =>
        sections.map((section) =>
          withCompetitors(
            appCard(`Primary app · ${appHeader(section)}`, section, origin),
            section,
            detailCap,
          ),
        ),
      notes: overflow(omitted, 'primary app group'),
      text: competitorText(payload),
    };
  }
  return {
    headline: legacyHeadline(payload),
    preview: windowLine(payload),
    stats: [],
    cards: (detailCap) =>
      sections.map((section) =>
        withCompetitors(ownedCard(section, detailCap), section, detailCap),
      ),
    notes: overflow(omitted, 'app group'),
    text: legacyBatchText(payload),
  };
}

function reportElement(
  payload: AlertBatchPayload,
  report: BatchReport,
  detailCap: number,
  context: AlertEmailContext,
): ReactElement {
  return (
    <ReportEmail
      headline={report.headline}
      preview={report.preview}
      stats={report.stats}
      window={windowLine(payload)}
      cards={report.cards(detailCap)}
      notes={report.notes}
      context={context}
    />
  );
}

export function batchEmailElement(
  payload: AlertBatchPayload,
  context: AlertEmailContext,
): ReactElement {
  return reportElement(
    payload,
    batchReport(payload, context.origin),
    DETAIL_LINE_CAP,
    context,
  );
}

async function fittingReport(
  payload: AlertBatchPayload,
  report: BatchReport,
  context: AlertEmailContext,
  tier = 0,
): Promise<EmailContent> {
  const email = await renderEmail(
    `[asobeast] ${report.headline}`,
    reportElement(payload, report, HTML_DETAIL_CAPS[tier], context),
    report.text,
  );
  const smallerTier = tier + 1 < HTML_DETAIL_CAPS.length;
  return smallerTier && Buffer.byteLength(email.html) > HTML_BUDGET_BYTES
    ? fittingReport(payload, report, context, tier + 1)
    : email;
}

export function formatBatchEmail(
  payload: AlertBatchPayload,
  context: AlertEmailContext = WITHOUT_LINKS,
): Promise<EmailContent> {
  return fittingReport(payload, batchReport(payload, context.origin), context);
}
