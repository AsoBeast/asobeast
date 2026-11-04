import {
  formatUtcDateRange,
  type RatingDroppedPayload,
} from '@asobeast/shared';
import type { ReportFact, ReportRow } from './report';
import { plural } from './report-rows';

const DAY_MS = 86_400_000;

const average = (value: number): string => value.toFixed(2);

const count = (value: number): string => value.toLocaleString('en-US');

const versionLabel = (version: string): string =>
  `v${version.replace(/^v/i, '')}`;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

export function ratingDropSentence(
  alert: RatingDroppedPayload,
  app: string,
  market: string,
): string {
  const days = plural(daysBetween(alert.fromDate, alert.toDate), 'day');
  const shipped = alert.version
    ? `, since ${versionLabel(alert.version)} shipped`
    : '';
  return `${app}'s average rating fell from ${average(alert.from)} to ${average(alert.to)} in ${market} over ${days}${shipped}`;
}

export function ratingDropFacts(
  alert: RatingDroppedPayload,
  market: string,
): ReportFact[] {
  return [
    { label: 'Market', value: market },
    {
      label: 'Rating',
      value: `${average(alert.from)} → ${average(alert.to)}`,
    },
    { label: 'Drop', value: plural(alert.dropTenths, 'tenth') },
    {
      label: 'Ratings',
      value: `${count(alert.fromCount)} → ${count(alert.toCount)}`,
    },
    {
      label: 'Period',
      value: formatUtcDateRange(alert.fromDate, alert.toDate),
    },
    ...(alert.version
      ? [{ label: 'Version', value: versionLabel(alert.version) }]
      : []),
  ];
}

export function ratingDropRow(alert: RatingDroppedPayload): ReportRow {
  const drop = `down ${plural(alert.dropTenths, 'tenth')}`;
  return {
    kind: 'move',
    label: 'Average rating',
    from: average(alert.from),
    to: average(alert.to),
    note: alert.version ? `${drop} · ${versionLabel(alert.version)}` : drop,
  };
}
