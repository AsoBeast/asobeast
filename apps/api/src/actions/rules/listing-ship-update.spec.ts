import type { ActionContextApp } from '../action-context';
import { scoreImpact } from '../action-impact';
import {
  detectListingShipUpdate,
  listingShipUpdateDetector,
} from './listing-ship-update';
import { actionContext, contextApp } from './rule-context.fixture';

const NOW = new Date('2026-07-30T03:00:00.000Z');

const daysAgo = (days: number): Date =>
  new Date(Date.UTC(2026, 6, 30 - days, 18));

const app = (
  days: number | null,
  competitorDays: number[] = [],
): ActionContextApp =>
  contextApp({
    latestStoreUpdatedAt: days === null ? null : daysAgo(days),
    latestVersion: '3.1.0',
    competitorUpdatedAt: competitorDays.map(daysAgo),
  });

const detect = (apps: ActionContextApp[]) =>
  detectListingShipUpdate(actionContext(apps), NOW);

const impactAt = (days: number, competitorDays: number[] = []) => {
  const [detection] = detect([app(days, competitorDays)]);
  return scoreImpact(detection.rule, detection.terms);
};

describe('listing.ship_update', () => {
  it('stays silent at 89 days', () => {
    expect(detect([app(89)])).toEqual([]);
  });

  it('fires at 90 days with the age alone', () => {
    const [detection] = detect([app(90)]);

    expect(detection).toEqual({
      rule: 'listing.ship_update',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: null,
      discriminator: null,
      terms: { reach: 0.4, severity: 0, confidence: 1 },
      evidence: {
        rule: 'listing.ship_update',
        storeUpdatedAt: daysAgo(90).toISOString(),
        daysSinceUpdate: 90,
        version: '3.1.0',
        competitorMedianDays: null,
        competitorsCompared: 0,
      },
    });
    expect(impactAt(90)).toEqual({ impact: 38, priority: 'medium' });
    expect(listingShipUpdateDetector.rule).toBe('listing.ship_update');
  });

  it('grows with age when no competitor is compared', () => {
    expect(impactAt(120)).toEqual({ impact: 46, priority: 'medium' });
  });

  it('adds competitor pressure when rivals updated recently', () => {
    expect(impactAt(180, [10, 20, 40])).toEqual({
      impact: 73,
      priority: 'high',
    });
  });

  it('stays silent without a known store update date', () => {
    expect(detect([app(null)])).toEqual([]);
  });

  it('takes the median of the known competitor update ages', () => {
    const [odd] = detect([app(142, [40, 10, 25])]);
    const [even] = detect([app(142, [40, 10, 25, 31])]);

    expect(odd.evidence).toMatchObject({
      competitorMedianDays: 25,
      competitorsCompared: 3,
    });
    expect(even.evidence).toMatchObject({
      competitorMedianDays: 28,
      competitorsCompared: 4,
    });
    expect(even.terms.severity).toBeCloseTo((52 / 90) * 0.7 + 0.3);
  });

  it('adds no competitor pressure when rivals are stale too', () => {
    const [detection] = detect([app(180, [45, 60])]);

    expect(detection.terms.severity).toBeCloseTo(0.7);
  });
});
