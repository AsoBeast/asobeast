import {
  funnelConversion,
  type ListingCppUnderperformsEvidence,
} from '@asobeast/shared';
import {
  DEFAULT_PAGE_TITLE,
  shiftDate,
} from '../../store-connect/store-funnel';
import type { ActionContext, ActionContextApp } from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const CPP_WINDOW_DAYS = 14;
export const CPP_MIN_UNIQUE_IMPRESSIONS = 100;
export const CPP_MAX_RATIO = 0.8;
export const CPP_CONFIDENCE_IMPRESSIONS = 1000;

const PLACES = 10_000;
const round = (value: number): number => Math.round(value * PLACES) / PLACES;

interface PageTotals {
  title: string;
  uniqueImpressions: number;
  gets: number;
}

const isDefault = (title: string): boolean =>
  title.trim().toLowerCase() === DEFAULT_PAGE_TITLE;

function totalsOf(app: ActionContextApp): PageTotals[] {
  const through = app.funnel.completeThrough;
  const from = shiftDate(through, 1 - CPP_WINDOW_DAYS);
  const byTitle = new Map<string, PageTotals>();
  for (const day of app.funnel.pages) {
    if (day.date < from || day.date > through) continue;
    const totals = byTitle.get(day.pageTitle) ?? {
      title: day.pageTitle,
      uniqueImpressions: 0,
      gets: 0,
    };
    totals.uniqueImpressions += day.uniqueImpressions;
    totals.gets += day.gets;
    byTitle.set(day.pageTitle, totals);
  }
  return [...byTitle.values()];
}

function detectForApp(app: ActionContextApp): DetectedAction[] {
  const pages = totalsOf(app);
  const base = pages.find((page) => isDefault(page.title));
  const defaultConversion = base
    ? funnelConversion(base.gets, base.uniqueImpressions)
    : null;
  if (!defaultConversion) return [];
  const impressions = pages.reduce(
    (sum, page) => sum + page.uniqueImpressions,
    0,
  );
  return pages.flatMap((page) => {
    if (isDefault(page.title)) return [];
    if (page.uniqueImpressions < CPP_MIN_UNIQUE_IMPRESSIONS) return [];
    const pageConversion =
      funnelConversion(page.gets, page.uniqueImpressions) ?? 0;
    const ratio = pageConversion / defaultConversion;
    if (ratio >= CPP_MAX_RATIO) return [];
    const evidence: ListingCppUnderperformsEvidence = {
      rule: 'listing.cpp_underperforms',
      country: app.country,
      pageTitle: page.title,
      windowDays: CPP_WINDOW_DAYS,
      pageUniqueImpressions: page.uniqueImpressions,
      pageConversion,
      defaultConversion,
      ratio: round(ratio),
    };
    return [
      {
        rule: 'listing.cpp_underperforms',
        appId: app.id,
        store: app.store,
        country: app.country,
        keywordId: null,
        discriminator: page.title,
        terms: {
          reach: round(clampUnit(page.uniqueImpressions / impressions)),
          severity: round(clampUnit(1 - ratio)),
          confidence: clampUnit(
            page.uniqueImpressions / CPP_CONFIDENCE_IMPRESSIONS,
          ),
        },
        evidence,
      },
    ];
  });
}

export function detectListingCppUnderperforms(
  context: ActionContext,
): DetectedAction[] {
  return context.apps.flatMap(detectForApp);
}

export const listingCppUnderperformsDetector: ActionDetector = {
  rule: 'listing.cpp_underperforms',
  detect: detectListingCppUnderperforms,
};
