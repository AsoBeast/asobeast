import {
  countChars,
  truncateChars,
  type AlertBatchAppSection,
  type AlertBatchPayload,
  type RankMilestonePayload,
} from '@asobeast/shared';
import {
  appName,
  foldedMilestoneSentence,
  plural,
  sentenceOf,
  type GranularPayload,
} from './report-sentences';
import { storefrontLabel } from './storefront';

export const LEAD_MAX_CHARS = 100;

interface Lead {
  text: string;
  covered: number;
}

type LeadSource = (section: AlertBatchAppSection) => readonly GranularPayload[];

const milestonesOf = (section: AlertBatchAppSection) =>
  section.rankMilestones ?? [];

const left = (section: AlertBatchAppSection) =>
  milestonesOf(section).filter((alert) => alert.direction === 'left');

const entered = (section: AlertBatchAppSection) =>
  milestonesOf(section).filter((alert) => alert.direction === 'entered');

const LEAD_PRIORITY: readonly LeadSource[] = [
  (section) => section.availability ?? [],
  left,
  (section) => section.rankDrops ?? [],
  (section) => section.ratingDrops ?? [],
  (section) => section.reviewSpikes ?? [],
  (section) => section.negativeReviews ?? [],
  (section) => section.overtakes ?? [],
  entered,
  (section) => section.firstRankings ?? [],
  (section) => section.rankImprovements ?? [],
  (section) => section.chartMoves ?? [],
  (section) => section.changes ?? [],
  (section) => section.serpEntrants ?? [],
  (section) => section.actions ?? [],
  (section) => section.newReviews ?? [],
];

const isLeftMilestone = (
  payload: GranularPayload,
): payload is RankMilestonePayload =>
  payload.event === 'rank.milestone' && payload.direction === 'left';

function foldedLead(
  first: RankMilestonePayload,
  section: AlertBatchAppSection,
): Lead {
  const country = first.keyword.country ?? null;
  const folded = left(section).filter(
    (alert) =>
      alert.tier === first.tier && (alert.keyword.country ?? null) === country,
  );
  return {
    text: foldedMilestoneSentence(
      appName(section.app.name),
      first.tier,
      folded.length,
      storefrontLabel(country, false),
    ),
    covered: folded.length,
  };
}

function leadRow(
  payload: AlertBatchPayload,
): { first: GranularPayload; section: AlertBatchAppSection } | null {
  for (const source of LEAD_PRIORITY) {
    for (const section of payload.apps) {
      const [first] = source(section);
      if (first) return { first, section };
    }
  }
  return null;
}

const clipped = (text: string): string =>
  countChars(text) > LEAD_MAX_CHARS
    ? `${truncateChars(text, LEAD_MAX_CHARS - 1)}…`
    : text;

export function leadOf(payload: AlertBatchPayload): string | null {
  if (payload.scope !== 'owned_apps') return null;
  const row = leadRow(payload);
  if (!row) return null;
  const lead: Lead = isLeftMilestone(row.first)
    ? foldedLead(row.first, row.section)
    : { text: sentenceOf(row.first, false).text, covered: 1 };
  const rest = payload.totals.events - lead.covered;
  const suffix = rest > 0 ? ` and ${plural(rest, 'more change')}` : '';
  return clipped(`${lead.text}${suffix}`.replace(/\s+/g, ' ').trim());
}
