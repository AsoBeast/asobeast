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
export const CPP_MIN_PAGE_VIEWS = 100;
export const CPP_MAX_RATIO = 0.8;
export const CPP_CONFIDENCE_PAGE_VIEWS = 500;

const PLACES = 10_000;
const round = (value: number): number => Math.round(value * PLACES) / PLACES;

interface PageTotals {
  title: string;
  pageViews: number;
  uniqueImpressions: number;
  gets: number;
}

const emptyTotals = (title: string): PageTotals => ({
  title,
  pageViews: 0,
  uniqueImpressions: 0,
  gets: 0,
});

const isDefault = (title: string): boolean =>
  title.trim().toLowerCase() === DEFAULT_PAGE_TITLE;

const conversionOf = (page: PageTotals): number | null =>
  funnelConversion(page.gets, page.pageViews);

function totalsOf(app: ActionContextApp): PageTotals[] {
  const through = app.funnel.completeThrough;
  const from = shiftDate(through, 1 - CPP_WINDOW_DAYS);
  const byTitle = new Map<string, PageTotals>();
  for (const day of app.funnel.pages) {
    if (day.date < from || day.date > through) continue;
    const totals = byTitle.get(day.pageTitle) ?? emptyTotals(day.pageTitle);
    totals.pageViews += day.pageViews;
    totals.uniqueImpressions += day.uniqueImpressions;
    totals.gets += day.gets;
    byTitle.set(day.pageTitle, totals);
  }
  return [...byTitle.values()];
}

function detection(
  app: ActionContextApp,
  page: PageTotals,
  shares: { defaultConversion: number; pageViews: number },
  withheld: boolean,
): DetectedAction {
  const pageConversion = conversionOf(page) ?? 0;
  const ratio =
    shares.defaultConversion > 0
      ? pageConversion / shares.defaultConversion
      : 0;
  const evidence: ListingCppUnderperformsEvidence = {
    rule: 'listing.cpp_underperforms',
    country: app.country,
    pageTitle: page.title,
    windowDays: CPP_WINDOW_DAYS,
    pageUniqueImpressions: page.uniqueImpressions,
    pageViews: page.pageViews,
    pageConversion,
    defaultConversion: shares.defaultConversion,
    ratio: round(ratio),
  };
  return {
    rule: 'listing.cpp_underperforms',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: page.title,
    terms: withheld
      ? { reach: 0, severity: 0, confidence: 0 }
      : {
          reach: round(
            clampUnit(page.pageViews / Math.max(shares.pageViews, 1)),
          ),
          severity: round(clampUnit(1 - ratio)),
          confidence: clampUnit(page.pageViews / CPP_CONFIDENCE_PAGE_VIEWS),
        },
    evidence,
    ...(withheld ? { withheld: true as const } : {}),
  };
}

function seenPages(app: ActionContextApp, recent: PageTotals[]): PageTotals[] {
  const titles = new Set(app.funnel.pages.map((day) => day.pageTitle));
  return [...titles]
    .filter((title) => !isDefault(title))
    .map(
      (title) =>
        recent.find((page) => page.title === title) ?? emptyTotals(title),
    );
}

function detectForApp(app: ActionContextApp): DetectedAction[] {
  const recent = totalsOf(app);
  const pages = seenPages(app, recent);
  const base = recent.find((page) => isDefault(page.title));
  const defaultConversion =
    base && base.pageViews >= CPP_MIN_PAGE_VIEWS ? conversionOf(base) : null;
  const shares = {
    defaultConversion: defaultConversion ?? 0,
    pageViews: recent.reduce((sum, page) => sum + page.pageViews, 0),
  };
  return pages.flatMap((page) => {
    if (
      !app.funnel.reporting ||
      !defaultConversion ||
      page.pageViews < CPP_MIN_PAGE_VIEWS
    ) {
      return [detection(app, page, shares, true)];
    }
    const pageConversion = conversionOf(page) ?? 0;
    if (pageConversion / defaultConversion >= CPP_MAX_RATIO) return [];
    return [detection(app, page, shares, false)];
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
