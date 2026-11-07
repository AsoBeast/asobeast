import {
  formatUtcDate,
  type AppAvailabilityPayload,
  type Store,
} from '@asobeast/shared';
import type { GroupTone, ReportFact, ReportRow } from './report';
import { plural } from './report-rows';
import { storeName } from './storefront';

const inStore = (store: Store): string =>
  store === 'GOOGLE_PLAY' ? 'Google Play' : 'the App Store';

const keywordsTracked = (count: number): string =>
  count === 1 ? '1 keyword is tracked' : `${count} keywords are tracked`;

const trackedThere = (alert: AppAvailabilityPayload): number =>
  alert.event === 'app.unlisted_market' ? alert.trackedKeywords : 0;

export function availabilitySentence(
  alert: AppAvailabilityPayload,
  app: string,
  home: string,
  market: string,
): string {
  const who = alert.app.isCompetitor ? `${app}, a competitor,` : app;
  const listed = `${who} is no longer listed in ${inStore(alert.store)}`;
  if (alert.event === 'app.delisted') return `${listed} (${home})`;
  const keywords = trackedThere(alert);
  return keywords > 0
    ? `${listed} in ${market}, where ${keywordsTracked(keywords)}`
    : `${listed} in ${market}`;
}

export function availabilityFacts(
  alert: AppAvailabilityPayload,
  home: string,
  market: string,
): ReportFact[] {
  const facts: ReportFact[] = [
    {
      label: 'Type',
      value: alert.app.isCompetitor ? 'Competitor' : 'Your app',
    },
    { label: 'Store', value: storeName(alert.store) },
    alert.event === 'app.delisted'
      ? { label: 'Storefront', value: home }
      : { label: 'Market', value: market },
    { label: 'Day', value: formatUtcDate(alert.date) },
  ];
  return alert.event === 'app.unlisted_market'
    ? [
        ...facts,
        { label: 'Keywords tracked there', value: `${alert.trackedKeywords}` },
      ]
    : facts;
}

export function availabilityRow(alert: AppAvailabilityPayload): ReportRow {
  if (alert.event === 'app.delisted') {
    return {
      kind: 'text',
      text: `No longer listed in ${inStore(alert.store)}`,
      detail: null,
    };
  }
  const keywords = trackedThere(alert);
  const market = `No longer listed in ${alert.market.toUpperCase()}`;
  return {
    kind: 'text',
    text:
      keywords > 0
        ? `${market} · ${plural(keywords, 'keyword')} tracked`
        : market,
    detail: null,
  };
}

export function availabilityTone(alert: AppAvailabilityPayload): GroupTone {
  return alert.app.isCompetitor ? 'neutral' : 'down';
}
