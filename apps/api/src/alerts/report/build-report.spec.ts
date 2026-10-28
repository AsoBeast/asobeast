import type { AlertBatchPayload } from '@asobeast/shared';
import {
  alpha,
  batch,
  competitorBatch,
  emptySection,
  improved,
  negative,
  newReview,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { milestone } from '../rank-events.fixture';
import { buildReport, DEFAULT_CAPS, reportCounts } from './build-report';

const ORIGIN = 'https://aso.example.com';
const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';

const owned = (apps: AlertBatchPayload['apps']): AlertBatchPayload => ({
  ...batch,
  totals: { events: apps.length, apps: apps.length },
  apps,
});

describe('buildReport', () => {
  it('heads the daily report with its counts and dates', () => {
    const report = buildReport(batch, ORIGIN);

    expect(report).toMatchObject({
      kind: 'batch',
      event: 'alerts.batch',
      emoji: '📊',
      headline: 'Daily app update: 3 changes across 2 apps',
      dateLabel: '22 Jul 2026',
      window: batch.window,
      link: { href: `${ORIGIN}/`, label: 'Open AsoBeast' },
      omittedApps: 0,
      facts: [],
    });
  });

  it('heads the competitor watch and an older report without a scope', () => {
    expect(buildReport(competitorBatch, null)).toMatchObject({
      emoji: '🔭',
      headline: 'Competitor watch: 1 change across 1 competitor',
    });
    expect(buildReport(worstCaseBatch(null), null)).toMatchObject({
      emoji: '📊',
      headline: 'Daily update: 9999 changes across 12 apps',
    });
  });

  it('keeps the identity of each app and links its page', () => {
    const report = buildReport(
      owned([{ ...alpha, app: { ...alpha.app, iconUrl: ICON } }]),
      ORIGIN,
    );

    expect(report.apps[0]).toMatchObject({
      id: 'a',
      identity: {
        name: 'Alpha',
        iconUrl: ICON,
        store: 'APP_STORE',
        country: 'us',
        role: 'primary',
      },
      link: { href: `${ORIGIN}/apps/a`, label: 'Open app' },
      competitors: [],
    });
  });

  it('names an app without a name and has no icon an older payload lacks', () => {
    const report = buildReport(
      owned([{ ...alpha, app: { ...alpha.app, name: null } }]),
      null,
    );

    expect(report.apps[0].identity).toMatchObject({
      name: 'An app',
      iconUrl: null,
    });
  });

  it('orders the groups of an app and titles them', () => {
    const section = {
      ...emptySection(alpha.app),
      changes: alpha.changes,
      rankDrops: alpha.rankDrops,
      rankImprovements: [improved],
      rankMilestones: [milestone()],
    };

    expect(
      buildReport(owned([section]), null).apps[0].groups.map((group) => [
        group.kind,
        group.title,
        group.tone,
      ]),
    ).toEqual([
      ['rankDrops', 'Rank drops', 'down'],
      ['rankImprovements', 'Rank improvements', 'up'],
      ['milestones', 'Milestones', 'up'],
      ['changes', 'Listing changes', 'neutral'],
    ]);
  });

  it('groups new reviews after negative reviews', () => {
    const section = {
      ...emptySection(alpha.app),
      negativeReviews: [negative],
      newReviews: [newReview],
    };

    expect(
      buildReport(owned([section]), null).apps[0].groups.map((group) => [
        group.kind,
        group.title,
      ]),
    ).toEqual([
      ['negativeReviews', 'Negative reviews'],
      ['newReviews', 'New reviews'],
    ]);
  });

  it('caps new reviews at the row cap and links the reviews page', () => {
    const reviews = Array.from({ length: 25 }, () => newReview);
    const [group] = buildReport(
      owned([{ ...emptySection(alpha.app), newReviews: reviews }]),
      ORIGIN,
    ).apps[0].groups;

    expect(group.rows).toHaveLength(DEFAULT_CAPS.rows);
    expect(group.total).toBe(25);
    expect(group.link).toEqual({
      href: `${ORIGIN}/apps/a/reviews?score=5`,
      label: 'See all 25 in AsoBeast',
    });
  });

  it.each([
    [[5, 4], 'up'],
    [[1, 2], 'down'],
    [[5, 1], 'neutral'],
  ] as const)('tones new reviews of %j %s', (scores, tone) => {
    const newReviews = scores.map((score) => ({
      ...newReview,
      review: { ...newReview.review, score },
    }));
    const [group] = buildReport(
      owned([{ ...emptySection(alpha.app), newReviews }]),
      null,
    ).apps[0].groups;

    expect(group.tone).toBe(tone);
  });

  it('builds no new review group for a section queued before it existed', () => {
    const report = buildReport(
      owned([{ ...emptySection(alpha.app), negativeReviews: [negative] }]),
      null,
    );

    expect(report.apps[0].groups.map((group) => group.kind)).toEqual([
      'negativeReviews',
    ]);
  });

  it('cuts every group at the row cap and keeps the total', () => {
    const report = buildReport(worstCaseBatch('owned_apps'), ORIGIN);
    const drops = report.apps[0].groups[0];

    expect(drops.rows).toHaveLength(DEFAULT_CAPS.rows);
    expect(drops.total).toBe(25);
    expect(drops.link).toEqual({
      href: `${ORIGIN}/apps/app_0/keywords`,
      label: 'See all 25 in AsoBeast',
    });
  });

  it('cuts the apps at the app cap and counts the rest', () => {
    const report = buildReport(worstCaseBatch('owned_apps'), null);

    expect(report.apps).toHaveLength(DEFAULT_CAPS.apps);
    expect(report.omittedApps).toBe(2);
  });

  it('nests competitors under their primary app in the competitor watch', () => {
    const report = buildReport(competitorBatch, ORIGIN);
    const [primary] = report.apps;

    expect(primary.groups).toEqual([]);
    expect(primary.competitors).toHaveLength(1);
    expect(primary.competitors[0]).toMatchObject({
      id: 'c',
      identity: { name: 'Charlie', role: 'competitor' },
      link: { href: `${ORIGIN}/apps/c` },
    });
    expect(primary.competitors[0].groups).toEqual([
      {
        kind: 'changes',
        title: 'Listing changes',
        tone: 'neutral',
        rows: [
          { kind: 'change', field: 'Subtitle', before: '"a"', after: '"b"' },
        ],
        total: 1,
        link: {
          href: `${ORIGIN}/apps/a/changes`,
          label: 'See all 1 in AsoBeast',
        },
      },
    ]);
  });

  it('cuts competitors at their cap and links the page that lists them', () => {
    const report = buildReport(worstCaseBatch('competitors'), ORIGIN);
    const [primary] = report.apps;

    expect(primary.competitors).toHaveLength(DEFAULT_CAPS.competitors);
    expect(primary.omittedCompetitors).toBe(2);
    expect(primary.competitorsLink).toEqual({
      href: `${ORIGIN}/apps/app_0/competitors`,
      label: 'See all 12 competitors',
    });
  });

  it('gives an older report without a scope both owned groups and competitors', () => {
    const [app] = buildReport(worstCaseBatch(null), null).apps;

    expect(app.groups.length).toBeGreaterThan(0);
    expect(app.competitors.length).toBeGreaterThan(0);
  });

  it('tones a report by the groups it holds', () => {
    const up = { ...emptySection(alpha.app), rankImprovements: [improved] };
    const neutral = { ...emptySection(alpha.app), changes: alpha.changes };

    expect(buildReport(owned([up]), null).tone).toBe('up');
    expect(buildReport(owned([alpha]), null).tone).toBe('down');
    expect(buildReport(owned([up, alpha]), null).tone).toBe('mixed');
    expect(buildReport(owned([neutral]), null).tone).toBe('neutral');
    expect(
      buildReport(
        owned([
          {
            ...emptySection(alpha.app),
            rankMilestones: [milestone({ direction: 'left' })],
          },
        ]),
        null,
      ).apps[0].groups[0].tone,
    ).toBe('down');
  });

  it('builds an empty report for an empty batch', () => {
    expect(buildReport(owned([]), null)).toMatchObject({
      apps: [],
      omittedApps: 0,
      tone: 'neutral',
    });
  });

  it('builds a report of thousands of events in well under a second', () => {
    const payload = worstCaseBatch(null);
    const started = performance.now();

    buildReport(payload, ORIGIN);

    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('reportCounts', () => {
  it('counts every kind of fact across the apps', () => {
    expect(reportCounts(batch)).toEqual({
      rankDrops: 1,
      rankImprovements: 0,
      milestones: 0,
      firstRankings: 0,
      overtakes: 0,
      serpEntrants: 1,
      changes: 1,
      negativeReviews: 0,
      newReviews: 0,
      actions: 0,
    });
  });

  it('counts new reviews', () => {
    expect(
      reportCounts({
        ...batch,
        apps: [
          { ...alpha, newReviews: [newReview, newReview] },
          { ...emptySection(alpha.app), newReviews: [newReview] },
        ],
      }).newReviews,
    ).toBe(3);
  });
});
