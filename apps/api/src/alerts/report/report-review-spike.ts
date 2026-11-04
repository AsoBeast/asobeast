import { formatUtcDate, type ReviewSpikePayload } from '@asobeast/shared';
import type { GroupTone, ReportFact, ReportRow } from './report';
import { clip, plural } from './report-rows';

const LOW_SHARE_DOWN = 0.5;

const count = (value: number): string => value.toLocaleString('en-US');

const median = (alert: ReviewSpikePayload): string =>
  `median ${count(alert.median)} a day`;

function lowReviews(alert: ReviewSpikePayload): string {
  const noun = alert.lowScoreMax === 1 ? 'star' : 'stars';
  return `${Math.round(alert.lowShare * 100)}% at ${alert.lowScoreMax} ${noun} or lower`;
}

const quotedTheme = (alert: ReviewSpikePayload): string =>
  alert.topTheme ? `"${clip(alert.topTheme.phrase)}"` : '';

export function reviewSpikeSentence(
  alert: ReviewSpikePayload,
  app: string,
): string {
  return `A spike of ${plural(alert.count, 'review')} for ${app} on ${formatUtcDate(alert.date)}: ${median(alert)}, ${lowReviews(alert)}`;
}

export function reviewSpikeFacts(alert: ReviewSpikePayload): ReportFact[] {
  return [
    { label: 'Day', value: formatUtcDate(alert.date) },
    { label: 'Reviews', value: count(alert.count) },
    { label: 'Median per day', value: count(alert.median) },
    { label: 'Spike above', value: count(alert.threshold) },
    { label: 'Low reviews', value: lowReviews(alert) },
    ...(alert.topTheme
      ? [
          {
            label: 'Top theme',
            value: `${quotedTheme(alert)}, ${plural(alert.topTheme.mentions, 'review')}, ${alert.topTheme.kind}`,
          },
        ]
      : []),
  ];
}

export function reviewSpikeRow(alert: ReviewSpikePayload): ReportRow {
  return {
    kind: 'text',
    text: `${formatUtcDate(alert.date)} · ${plural(alert.count, 'review')}, ${median(alert)} · ${lowReviews(alert)}`,
    detail: alert.topTheme
      ? `Top theme: ${quotedTheme(alert)} (${plural(alert.topTheme.mentions, 'review')})`
      : null,
  };
}

export function reviewSpikeTone(
  alerts: readonly ReviewSpikePayload[],
): GroupTone {
  return alerts.some((alert) => alert.lowShare >= LOW_SHARE_DOWN)
    ? 'down'
    : 'neutral';
}
