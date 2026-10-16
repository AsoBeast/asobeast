import {
  funnelConversion,
  type ConversionInvestigateDropEvidence,
} from '@asobeast/shared';
import { shiftDate } from '../../store-connect/store-funnel';
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

const SPAN = CONVERSION_WINDOW_DAYS + CONVERSION_BASELINE_DAYS;

function calendarDays(app: ActionContextApp): ActionFunnelDay[] | null {
  const byDate = new Map(app.funnel.days.map((day) => [day.date, day]));
  const days: ActionFunnelDay[] = [];
  for (let back = SPAN - 1; back >= 0; back -= 1) {
    const day = byDate.get(shiftDate(app.funnel.completeThrough, -back));
    if (!day) return null;
    days.push(day);
  }
  return days;
}

interface Measured {
  baseline: Period;
  recent: Period;
  evidence: ConversionInvestigateDropEvidence;
}

function measure(app: ActionContextApp, days: ActionFunnelDay[]): Measured {
  const baseline = periodOf(days.slice(0, CONVERSION_BASELINE_DAYS));
  const recent = periodOf(days.slice(CONVERSION_BASELINE_DAYS));
  return {
    baseline,
    recent,
    evidence: {
      rule: 'conversion.investigate_drop',
      country: app.country,
      windowDays: CONVERSION_WINDOW_DAYS,
      baselineDays: CONVERSION_BASELINE_DAYS,
      completeThrough: app.funnel.completeThrough,
      pageViewsBefore: round1(baseline.pageViews / CONVERSION_BASELINE_DAYS),
      pageViewsAfter: round1(recent.pageViews / CONVERSION_WINDOW_DAYS),
      getsBefore: round1(baseline.gets / CONVERSION_BASELINE_DAYS),
      getsAfter: round1(recent.gets / CONVERSION_WINDOW_DAYS),
      conversionBefore: funnelConversion(
        baseline.gets,
        baseline.uniqueImpressions,
      ),
      conversionAfter: funnelConversion(recent.gets, recent.uniqueImpressions),
    },
  };
}

function detection(
  app: ActionContextApp,
  evidence: ConversionInvestigateDropEvidence,
  terms: DetectedAction['terms'],
  withheld: boolean,
): DetectedAction {
  return {
    rule: 'conversion.investigate_drop',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: null,
    terms,
    evidence,
    ...(withheld ? { withheld: true as const } : {}),
  };
}

const NO_TERMS = { reach: 0, severity: 0, confidence: 0 };

function detectForApp(app: ActionContextApp): DetectedAction | null {
  const days = app.funnel.reporting ? calendarDays(app) : null;
  const { baseline, recent, evidence } = measure(app, days ?? []);
  const hold = () => detection(app, evidence, NO_TERMS, true);
  if (!days || baseline.pageViews === 0 || baseline.gets === 0) return hold();
  const pageViewsBefore = baseline.pageViews / CONVERSION_BASELINE_DAYS;
  const pageViewsAfter = recent.pageViews / CONVERSION_WINDOW_DAYS;
  const getsBefore = baseline.gets / CONVERSION_BASELINE_DAYS;
  const getsAfter = recent.gets / CONVERSION_WINDOW_DAYS;
  if (
    Math.abs(relativeChange(pageViewsAfter, pageViewsBefore)) >
    CONVERSION_PAGE_VIEW_TOLERANCE
  ) {
    return hold();
  }
  const drop = -relativeChange(getsAfter, getsBefore);
  const lost = (getsBefore - getsAfter) * CONVERSION_WINDOW_DAYS;
  if (drop < CONVERSION_MIN_DROP || lost < CONVERSION_MIN_GETS) return null;
  return detection(
    app,
    evidence,
    {
      reach: clampUnit(drop),
      severity: clampUnit(drop / CONVERSION_SEVERE_DROP),
      confidence: clampUnit(
        (getsBefore * CONVERSION_WINDOW_DAYS) / CONVERSION_CONFIDENCE_GETS,
      ),
    },
    false,
  );
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
