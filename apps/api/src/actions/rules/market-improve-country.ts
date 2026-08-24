import { MarketImproveCountryEvidence } from '@asobeast/shared';
import type {
  ActionContext,
  ActionContextApp,
  ActionVisibilityPoint,
} from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { windowCutoff } from './window';

export const MARKET_MIN_KEYWORDS = 5;
export const MARKET_MIN_OBSERVED_DAYS = 7;
export const MARKET_WINDOW_DAYS = 14;
export const MARKET_MIN_GAP = 15;
export const MARKET_TOTAL_SEVERITY_GAP = 40;

function withinWindow(
  points: ActionVisibilityPoint[],
  cutoff: string,
): ActionVisibilityPoint[] {
  return points.filter((point) => point.date >= cutoff);
}

function meanVisibility(points: ActionVisibilityPoint[]): number {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + point.visibility, 0);
  return Math.round((total / points.length) * 10) / 10;
}

function activeIn(app: ActionContextApp, country: string): number {
  return (app.keywordsByCountry.get(country) ?? []).filter(
    (keyword) => keyword.active,
  ).length;
}

function rankedIn(app: ActionContextApp, country: string): number {
  return (app.keywordsByCountry.get(country) ?? []).filter(
    (keyword) => keyword.active && keyword.latestPosition !== null,
  ).length;
}

function detectForApp(app: ActionContextApp, now: Date): DetectedAction[] {
  const cutoff = windowCutoff(now, MARKET_WINDOW_DAYS);
  const homeCountry = app.country;
  const homePoints = withinWindow(
    app.visibilityByCountry.get(homeCountry) ?? [],
    cutoff,
  );
  if (homePoints.length < MARKET_MIN_OBSERVED_DAYS) return [];

  const homeVisibility = meanVisibility(homePoints);
  const totalTracked = app.trackedKeywords.filter(
    (keyword) => keyword.active,
  ).length;
  if (totalTracked === 0) return [];

  const detections: DetectedAction[] = [];
  for (const country of [...app.keywordsByCountry.keys()].sort()) {
    if (country === homeCountry) continue;

    const trackedKeywords = activeIn(app, country);
    if (trackedKeywords < MARKET_MIN_KEYWORDS) continue;

    const marketPoints = withinWindow(
      app.visibilityByCountry.get(country) ?? [],
      cutoff,
    );
    if (marketPoints.length < MARKET_MIN_OBSERVED_DAYS) continue;

    const marketVisibility = meanVisibility(marketPoints);
    const gap = Math.round((homeVisibility - marketVisibility) * 10) / 10;
    if (gap < MARKET_MIN_GAP) continue;

    const observedDays = Math.min(marketPoints.length, homePoints.length);
    const evidence: MarketImproveCountryEvidence = {
      rule: 'market.improve_country',
      country,
      homeCountry,
      marketVisibility,
      homeVisibility,
      gap,
      trackedKeywords,
      rankedKeywords: rankedIn(app, country),
      observedDays,
      windowDays: MARKET_WINDOW_DAYS,
    };

    detections.push({
      rule: 'market.improve_country',
      appId: app.id,
      store: app.store,
      country,
      keywordId: null,
      discriminator: null,
      terms: {
        reach: trackedKeywords / totalTracked,
        severity: gap / MARKET_TOTAL_SEVERITY_GAP,
        confidence: observedDays / MARKET_WINDOW_DAYS,
      },
      evidence,
    });
  }
  return detections;
}

export function detectMarketImproveCountry(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps.flatMap((app) => detectForApp(app, now));
}

export const marketImproveCountryDetector: ActionDetector = {
  rule: 'market.improve_country',
  detect: detectMarketImproveCountry,
};
