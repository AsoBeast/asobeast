import type { ActionPageDay } from '../action-funnel';
import { actionFingerprint } from '../action-fingerprint';
import { actionContext, contextApp } from './rule-context.fixture';
import {
  CPP_MIN_PAGE_VIEWS,
  detectListingCppUnderperforms,
} from './listing-cpp-underperforms';

const THROUGH = '2026-10-13';

const pageDay = (
  pageTitle: string,
  pageViews: number,
  gets: number,
  date = '2026-10-10',
): ActionPageDay => ({
  date,
  pageTitle,
  pageViews,
  uniqueImpressions: 0,
  gets,
});

const detectAll = (pages: ActionPageDay[], reporting = true) =>
  detectListingCppUnderperforms(
    actionContext([
      contextApp({
        funnel: { reporting, completeThrough: THROUGH, days: [], pages },
      }),
    ]),
  );

const detect = (pages: ActionPageDay[]) =>
  detectAll(pages).filter((action) => !action.withheld);

const withheld = (pages: ActionPageDay[], reporting = true) =>
  detectAll(pages, reporting)
    .filter((action) => action.withheld)
    .map((action) => action.discriminator);

const DEFAULT = pageDay('default product page', 10_000, 400);

describe('listing.cpp_underperforms', () => {
  it('judges pages by Get taps over product page views, since Apple counts no impression against a page', () => {
    const actions = detectAll([
      pageDay('Default product page', 400, 100),
      pageDay('Summer sale', 200, 10),
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0]).not.toHaveProperty('withheld');
    expect(actions[0].evidence).toMatchObject({
      pageTitle: 'Summer sale',
      pageConversion: 0.05,
      defaultConversion: 0.25,
      ratio: 0.2,
    });
  });

  it('opens for a page under four fifths of the default, never at the boundary', () => {
    expect(detect([DEFAULT, pageDay('Summer sale', 1000, 32)])).toHaveLength(0);
    expect(detect([DEFAULT, pageDay('Summer sale', 1000, 31)])).toHaveLength(1);
  });

  it('needs a hundred product page views on the page', () => {
    expect(
      detect([DEFAULT, pageDay('Summer sale', CPP_MIN_PAGE_VIEWS - 1, 0)]),
    ).toHaveLength(0);
    expect(
      detect([DEFAULT, pageDay('Summer sale', CPP_MIN_PAGE_VIEWS, 0)]),
    ).toHaveLength(1);
  });

  it('needs a default page conversion', () => {
    expect(detect([pageDay('Summer sale', 1000, 1)])).toHaveLength(0);
    expect(
      detect([
        pageDay('default product page', 0, 0),
        pageDay('Summer sale', 1000, 1),
      ]),
    ).toHaveLength(0);
  });

  it('opens one action per page with the title as the discriminator, never for the default page', () => {
    const actions = detect([
      DEFAULT,
      pageDay('Summer sale', 1000, 10),
      pageDay('Winter deal', 2000, 20),
    ]);

    expect(actions.map((action) => action.discriminator).sort()).toEqual([
      'Summer sale',
      'Winter deal',
    ]);
    expect(actions.every((action) => action.keywordId === null)).toBe(true);
  });

  it('holds the actions of every page it saw while the console stops reporting', () => {
    expect(
      withheld([DEFAULT, pageDay('Summer sale', 1000, 10)], false),
    ).toEqual(['Summer sale']);
  });

  it('holds a page it cannot judge instead of resolving it', () => {
    expect(
      withheld([DEFAULT, pageDay('Summer sale', 1000, 1, '2026-09-20')]),
    ).toEqual(['Summer sale']);
    expect(
      withheld([
        pageDay('default product page', CPP_MIN_PAGE_VIEWS - 1, 10),
        pageDay('Summer sale', 1000, 1),
      ]),
    ).toEqual(['Summer sale']);
    expect(
      withheld([DEFAULT, pageDay('Summer sale', CPP_MIN_PAGE_VIEWS - 1, 0)]),
    ).toEqual(['Summer sale']);
  });

  it('resolves a page that now converts like the default', () => {
    expect(detectAll([DEFAULT, pageDay('Summer sale', 1000, 40)])).toEqual([]);
  });

  it('reads only the last fourteen complete days', () => {
    expect(
      detect([
        DEFAULT,
        pageDay('Summer sale', 1000, 1, '2026-09-28'),
        pageDay('Summer sale', 1000, 1, '2026-10-14'),
      ]),
    ).toHaveLength(0);
  });

  it('normalizes the title in the fingerprint and keeps it in the evidence', () => {
    const [first] = detect([DEFAULT, pageDay('Summer  Sale', 1000, 10)]);
    const [second] = detect([DEFAULT, pageDay('summer sale', 1000, 10)]);

    expect(actionFingerprint(first)).toBe(actionFingerprint(second));
    expect(first.evidence).toMatchObject({ pageTitle: 'Summer  Sale' });
  });

  it('carries the evidence and scores reach by page view share, severity by the shortfall, confidence by the sample', () => {
    const [action] = detect([
      DEFAULT,
      pageDay('Summer sale', 1000, 20, '2026-09-30'),
    ]);

    expect(action.evidence).toEqual({
      rule: 'listing.cpp_underperforms',
      country: 'us',
      pageTitle: 'Summer sale',
      windowDays: 14,
      pageUniqueImpressions: 0,
      pageViews: 1000,
      pageConversion: 0.02,
      defaultConversion: 0.04,
      ratio: 0.5,
    });
    expect(action.terms).toEqual({
      reach: 0.0909,
      severity: 0.5,
      confidence: 1,
    });
  });
});
