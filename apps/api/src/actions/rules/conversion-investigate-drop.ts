import {
  funnelConversion,
  type ConversionInvestigateDropEvidence,
} from '@asobeast/shared';
import type { ActionContext, ActionContextApp } from '../action-context';
import type { ActionFunnelDay } from '../action-funnel';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const CONVERSION_WINDOW_DAYS = 7;
export const CONVERSION_BASELINE_DAYS = 14;
export const CONVERSION_MIN_GETS = 20;
export const CONVERSION_MIN_DROP = 0.2;
export const CONVERSION_PAGE_VIEW_TOLERANCE = 0.1;
export const CONVERSION_SEVERE_DROP = 0.5;
export const CONVERSION_CONFIDENCE_GETS = 200;

const PLACES = 10_000;
const round = (value: number): number => Math.round(value * PLACES) / PLACES;
const round1 = (value: number): number => Math.round(value * 10) / 10;

interface Period {
  pageViews: number;
  gets: number;
  uniqueImpressions: number;
}

function periodOf(days: ActionFunnelDay[]): Period {
  return days.reduce(
    (sum, day) => ({
      pageViews: sum.pageViews + day.pageViews,
      gets: sum.gets + day.gets,
      uniqueImpressions: sum.uniqueImpressions + day.uniqueImpressions,
    }),
    { pageViews: 0, gets: 0, uniqueImpressions: 0 },
  );
}

const relativeChange = (after: number, before: number): number =>
  round((after - before) / before);

function detectForApp(app: ActionContextApp): DetectedAction | null {
  const span = CONVERSION_WINDOW_DAYS + CONVERSION_BASELINE_DAYS;
  const complete = app.funnel.days.filter(
    (day) => day.date <= app.funnel.completeThrough,
  );
  if (complete.length < span) return null;
  const days = complete.slice(-span);
  const baseline = periodOf(days.slice(0, CONVERSION_BASELINE_DAYS));
  const recent = periodOf(days.slice(CONVERSION_BASELINE_DAYS));
  const pageViewsBefore = baseline.pageViews / CONVERSION_BASELINE_DAYS;
  const pageViewsAfter = recent.pageViews / CONVERSION_WINDOW_DAYS;
  const getsBefore = baseline.gets / CONVERSION_BASELINE_DAYS;
  const getsAfter = recent.gets / CONVERSION_WINDOW_DAYS;
  if (pageViewsBefore === 0 || getsBefore === 0) return null;
  const pageViewsShift = Math.abs(
    relativeChange(pageViewsAfter, pageViewsBefore),
  );
  const drop = -relativeChange(getsAfter, getsBefore);
  const lost = (getsBefore - getsAfter) * CONVERSION_WINDOW_DAYS;
  if (
    pageViewsShift > CONVERSION_PAGE_VIEW_TOLERANCE ||
    drop < CONVERSION_MIN_DROP ||
    lost < CONVERSION_MIN_GETS
  ) {
    return null;
  }
  const evidence: ConversionInvestigateDropEvidence = {
    rule: 'conversion.investigate_drop',
    country: app.country,
    windowDays: CONVERSION_WINDOW_DAYS,
    baselineDays: CONVERSION_BASELINE_DAYS,
    completeThrough: app.funnel.completeThrough,
    pageViewsBefore: round1(pageViewsBefore),
    pageViewsAfter: round1(pageViewsAfter),
    getsBefore: round1(getsBefore),
    getsAfter: round1(getsAfter),
    conversionBefore: funnelConversion(
      baseline.gets,
      baseline.uniqueImpressions,
    ),
    conversionAfter: funnelConversion(recent.gets, recent.uniqueImpressions),
  };
  return {
    rule: 'conversion.investigate_drop',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: null,
    terms: {
      reach: clampUnit(drop),
      severity: clampUnit(drop / CONVERSION_SEVERE_DROP),
      confidence: clampUnit(
        (getsBefore * CONVERSION_WINDOW_DAYS) / CONVERSION_CONFIDENCE_GETS,
      ),
    },
    evidence,
  };
}

export function detectConversionInvestigateDrop(
  context: ActionContext,
): DetectedAction[] {
  return context.apps
    .map(detectForApp)
    .filter((detection): detection is DetectedAction => detection !== null);
}

export const conversionInvestigateDropDetector: ActionDetector = {
  rule: 'conversion.investigate_drop',
  detect: detectConversionInvestigateDrop,
};
