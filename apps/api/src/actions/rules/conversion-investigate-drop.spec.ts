import { ACTION_ADVISORY_MAX_IMPACT } from '@asobeast/shared';
import type { ActionFunnelDay } from '../action-funnel';
import { actionFingerprint } from '../action-fingerprint';
import { scoreImpact } from '../action-impact';
import { actionContext, contextApp } from './rule-context.fixture';
import {
  CONVERSION_BASELINE_DAYS,
  CONVERSION_WINDOW_DAYS,
  detectConversionInvestigateDrop,
} from './conversion-investigate-drop';

const THROUGH = '2026-10-13';

const dateBack = (days: number): string =>
  new Date(Date.UTC(2026, 9, 13 - days)).toISOString().slice(0, 10);

const series = (
  before: Partial<ActionFunnelDay>,
  after: Partial<ActionFunnelDay>,
  count = CONVERSION_WINDOW_DAYS + CONVERSION_BASELINE_DAYS,
): ActionFunnelDay[] =>
  Array.from({ length: count }, (_, index) => {
    const back = count - 1 - index;
    const recent = back < CONVERSION_WINDOW_DAYS;
    return {
      date: dateBack(back),
      pageViews: 100,
      gets: 10,
      uniqueImpressions: 500,
      ...(recent ? after : before),
    };
  });

const detectAll = (
  days: ActionFunnelDay[],
  extra: ActionFunnelDay[] = [],
  reporting = true,
) =>
  detectConversionInvestigateDrop(
    actionContext([
      contextApp({
        funnel: {
          reporting,
          completeThrough: THROUGH,
          days: [...days, ...extra],
          pages: [],
        },
      }),
    ]),
  );

const detect = (days: ActionFunnelDay[], extra: ActionFunnelDay[] = []) =>
  detectAll(days, extra).filter((action) => !action.withheld);

const withheld = (days: ActionFunnelDay[], reporting = true) =>
  detectAll(days, [], reporting).filter((action) => action.withheld);

describe('conversion.investigate_drop', () => {
  it('opens when taps fall while page views hold', () => {
    expect(detect(series({}, { gets: 7 }))).toHaveLength(1);
  });

  it('stays silent just under a fifth', () => {
    expect(detect(series({ gets: 1000 }, { gets: 801 }))).toHaveLength(0);
    expect(detect(series({ gets: 1000 }, { gets: 800 }))).toHaveLength(1);
  });

  it('holds an open action while page views move, so a traffic shift never confirms a fix', () => {
    expect(detect(series({}, { gets: 5, pageViews: 85 }))).toHaveLength(0);
    expect(withheld(series({}, { gets: 5, pageViews: 85 }))).toHaveLength(1);
    expect(withheld(series({}, { gets: 10, pageViews: 120 }))).toHaveLength(1);
    expect(detect(series({}, { gets: 5, pageViews: 90 }))).toHaveLength(1);
  });

  it('holds an open action while the console stops reporting', () => {
    expect(detect(series({}, { gets: 5 }), [])).toHaveLength(1);
    expect(withheld(series({}, { gets: 5 }), false)).toHaveLength(1);
    expect(withheld([], false)).toHaveLength(1);
  });

  it('reads twenty one calendar days and holds while one of them is missing', () => {
    const gap = series({}, { gets: 5 }).filter(
      (day) => day.date !== dateBack(10),
    );

    expect(detect(gap)).toHaveLength(0);
    expect(withheld(gap)).toHaveLength(1);
  });

  it('resolves once taps recover against page views', () => {
    expect(detectAll(series({}, {}))).toEqual([]);
  });

  it('stays silent under twenty lost taps', () => {
    expect(detect(series({ gets: 2 }, { gets: 1 }))).toHaveLength(0);
  });

  it('needs twenty one complete days', () => {
    expect(detect(series({}, { gets: 5 }, 20))).toHaveLength(0);
    expect(withheld(series({}, { gets: 5 }, 20))).toHaveLength(1);
  });

  it('reads only complete days', () => {
    const later = [1, 2, 3].map((offset) => ({
      date: new Date(Date.UTC(2026, 9, 13 + offset)).toISOString().slice(0, 10),
      pageViews: 100,
      gets: 0,
      uniqueImpressions: 500,
    }));

    expect(detect(series({}, {}), later)).toHaveLength(0);
  });

  it('uses one fingerprint per app and home market and carries the evidence', () => {
    const [action] = detect(series({}, { gets: 6 }));

    expect(action).toMatchObject({
      rule: 'conversion.investigate_drop',
      appId: 'app_1',
      store: 'APP_STORE',
      country: 'us',
      keywordId: null,
      discriminator: null,
      evidence: {
        rule: 'conversion.investigate_drop',
        country: 'us',
        windowDays: 7,
        baselineDays: 14,
        completeThrough: THROUGH,
        pageViewsBefore: 100,
        pageViewsAfter: 100,
        getsBefore: 10,
        getsAfter: 6,
        conversionBefore: 0.02,
        conversionAfter: 0.012,
      },
    });
  });

  it('scores reach by the share of taps lost, severity by the fall and confidence by the sample, capped as advisory', () => {
    const [action] = detect(series({}, { gets: 6 }));

    expect(action.terms).toEqual({
      reach: 0.4,
      severity: 0.8,
      confidence: 0.35,
    });
    expect(
      scoreImpact('conversion.investigate_drop', action.terms).impact,
    ).toBeLessThanOrEqual(ACTION_ADVISORY_MAX_IMPACT);
  });

  it('opens nothing without funnel days', () => {
    expect(detect([])).toEqual([]);
  });

  it('holds with the same fingerprint the open action carries', () => {
    const [open] = detect(series({}, { gets: 6 }));
    const [held] = withheld([], false);

    expect(actionFingerprint(held)).toBe(actionFingerprint(open));
  });
});
