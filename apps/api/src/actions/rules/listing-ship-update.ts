import { ListingShipUpdateEvidence } from '@asobeast/shared';
import { DAY_MS, startOfUtcDay } from '../../analytics/analytics.support';
import type { ActionContext, ActionContextApp } from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const STALE_MIN_DAYS = 90;
export const STALE_SEVERE_DAYS = 180;
export const STALE_FRESH_COMPETITOR_DAYS = 30;
export const STALE_REACH = 0.4;
export const STALE_AGE_WEIGHT = 0.7;
export const STALE_COMPETITOR_WEIGHT = 0.3;

const daysBetween = (from: Date, to: Date): number =>
  Math.round(
    (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS,
  );

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function detectForApp(app: ActionContextApp, now: Date): DetectedAction | null {
  if (app.latestStoreUpdatedAt === null) return null;
  const daysSinceUpdate = daysBetween(app.latestStoreUpdatedAt, now);
  if (daysSinceUpdate < STALE_MIN_DAYS) return null;

  const competitorDays = app.competitorUpdatedAt.map((updatedAt) =>
    daysBetween(updatedAt, now),
  );
  const competitorMedianDays = median(competitorDays);
  const competitorsFresh =
    competitorMedianDays !== null &&
    competitorMedianDays <= STALE_FRESH_COMPETITOR_DAYS;
  const evidence: ListingShipUpdateEvidence = {
    rule: 'listing.ship_update',
    storeUpdatedAt: app.latestStoreUpdatedAt.toISOString(),
    daysSinceUpdate,
    version: app.latestVersion,
    competitorMedianDays,
    competitorsCompared: competitorDays.length,
  };
  return {
    rule: 'listing.ship_update',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: null,
    terms: {
      reach: STALE_REACH,
      severity:
        clampUnit(
          (daysSinceUpdate - STALE_MIN_DAYS) /
            (STALE_SEVERE_DAYS - STALE_MIN_DAYS),
        ) *
          STALE_AGE_WEIGHT +
        (competitorsFresh ? STALE_COMPETITOR_WEIGHT : 0),
      confidence: 1,
    },
    evidence,
  };
}

export function detectListingShipUpdate(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps
    .map((app) => detectForApp(app, now))
    .filter((detection): detection is DetectedAction => detection !== null);
}

export const listingShipUpdateDetector: ActionDetector = {
  rule: 'listing.ship_update',
  detect: detectListingShipUpdate,
};
