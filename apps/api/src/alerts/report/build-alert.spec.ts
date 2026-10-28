import { ACTION_RULE_TITLES } from '@asobeast/shared';
import {
  actionOpened,
  digest,
  digestWithGroups,
  dropped,
  everyFieldChanged,
  improved,
  metadata,
  negative,
} from '../email-fixtures.fixture';
import {
  chartEntered,
  chartLeft,
  chartMilestone,
} from '../chart-events.fixture';
import { firstRanking, milestone, overtake } from '../rank-events.fixture';
import { buildAlert } from './build-alert';
import type { ReportFact } from './report';

const ORIGIN = 'https://aso.example.com';
const ICON = 'https://play-lh.googleusercontent.com/icon';

const factMap = (facts: ReportFact[]) =>
  Object.fromEntries(facts.map((fact) => [fact.label, fact.value]));

describe('buildAlert', () => {
  it('heads a rank drop with its sentence, instant and app', () => {
    const report = buildAlert(
      {
        ...dropped,
        app: {
          ...dropped.app,
          iconUrl: ICON,
          store: 'GOOGLE_PLAY',
          country: 'us',
        },
      },
      ORIGIN,
    );

    expect(report).toMatchObject({
      kind: 'single',
      event: 'rank.dropped',
      emoji: '📉',
      headline: 'My App dropped from #4 to #12 for "fitness app" in 🇺🇸 US',
      tone: 'down',
      dateLabel: '11 Jul 2026, 00:00 UTC',
      window: null,
      link: { href: `${ORIGIN}/apps/app_1`, label: 'Open app' },
      omittedApps: 0,
    });
    expect(report.apps).toEqual([
      expect.objectContaining({
        id: 'app_1',
        identity: {
          name: 'My App',
          iconUrl: ICON,
          store: 'GOOGLE_PLAY',
          country: 'us',
          role: 'primary',
        },
      }),
    ]);
  });

  it('leaves the identity empty for a payload queued before it existed', () => {
    expect(buildAlert(dropped, null).apps[0].identity).toEqual({
      name: 'My App',
      iconUrl: null,
      store: null,
      country: null,
      role: 'primary',
    });
  });

  it('writes the storefront without its flag on request', () => {
    expect(buildAlert(dropped, null, false).headline).toBe(
      'My App dropped from #4 to #12 for "fitness app" in US',
    );
  });

  it('lists the facts of a rank move with the renamed threshold', () => {
    expect(buildAlert(dropped, null).facts).toEqual([
      { label: 'Keyword', value: 'fitness app (US)' },
      { label: 'From', value: '#4' },
      { label: 'To', value: '#12' },
      { label: 'Alert threshold', value: '5' },
    ]);
  });

  it('labels each changed field and never prints an icon url', () => {
    const facts = buildAlert(metadata, null).facts;

    expect(facts).toEqual([
      { label: 'Type', value: 'Your app' },
      { label: 'Title', value: '"A" → "B"' },
      { label: 'Icon', value: 'Changed' },
    ]);
  });

  it('labels every change field and clips long values', () => {
    const facts = factMap(buildAlert(everyFieldChanged, null).facts);

    expect(facts["What's new"]).toMatch(
      /^"whatsNew before the release, .+…" → /,
    );
    expect(facts['Screenshot images']).toBe('Replaced or reordered');
    expect(facts['Short description']).toBeDefined();
  });

  it('carries the rows of a listing change on its app', () => {
    const [app] = buildAlert(metadata, null).apps;

    expect(app.groups).toEqual([
      {
        kind: 'changes',
        title: 'Listing changes',
        tone: 'neutral',
        rows: [
          { kind: 'change', field: 'Title', before: '"A"', after: '"B"' },
          {
            kind: 'image',
            field: 'Icon changed',
            beforeUrl: null,
            afterUrl: 'y',
          },
        ],
        total: 2,
        link: null,
      },
    ]);
    expect(buildAlert(dropped, null).apps[0].groups).toEqual([]);
  });

  it('marks a competitor change as the competitor', () => {
    const report = buildAlert(
      { ...metadata, app: { ...metadata.app, isCompetitor: true } },
      null,
    );

    expect(report.apps[0].identity.role).toBe('competitor');
    expect(report.facts[0]).toEqual({ label: 'Type', value: 'Competitor' });
  });

  it('keeps the full words of a review and names a rating only one', () => {
    expect(buildAlert(negative, null).facts).toEqual([
      { label: 'Rating', value: '★☆☆☆☆' },
      { label: 'Version', value: '2.0.0' },
      { label: 'Title', value: 'Bad' },
      { label: 'Review', value: 'Crashes on <launch>' },
    ]);
    expect(
      factMap(
        buildAlert(
          { ...negative, review: { ...negative.review, text: ' ' } },
          null,
        ).facts,
      ).Review,
    ).toBe('no written review');
  });

  it('dates the entrants of a top 10 and opens the home page', () => {
    const report = buildAlert(
      {
        event: 'serp.entrant',
        occurredAt: dropped.occurredAt,
        keyword: dropped.keyword,
        date: '2026-07-11',
        entrants: [
          {
            position: 3,
            storeAppId: 's',
            title: 'Rival',
            appId: 'r',
            isCompetitor: true,
          },
        ],
      },
      ORIGIN,
    );

    expect(report.facts).toEqual([
      { label: 'Keyword', value: 'fitness app (US)' },
      { label: 'Date', value: '11 Jul 2026' },
      { label: '#3', value: 'Rival (competitor)' },
    ]);
    expect(report.apps).toEqual([]);
    expect(report.link).toEqual({ href: `${ORIGIN}/`, label: 'Open AsoBeast' });
  });

  it('names an action by its rule title and opens the action', () => {
    const report = buildAlert(actionOpened, null);

    expect(factMap(report.facts)).toMatchObject({
      Rule: ACTION_RULE_TITLES['keyword.add_uncovered'],
      Priority: 'High',
      Impact: '71',
      Keyword: 'budget planner (US)',
    });
    expect(report.link).toEqual({
      href: actionOpened.link,
      label: 'Open the action',
    });
  });

  it('lists the moves of the new rank events', () => {
    expect(factMap(buildAlert(milestone(), null).facts)).toEqual({
      Keyword: 'habit tracker (US)',
      Milestone: 'entered the top 10',
      From: '#14',
      To: '#8',
    });
    expect(factMap(buildAlert(firstRanking(), null).facts).Position).toBe(
      '#37',
    );
    expect(factMap(buildAlert(overtake(), null).facts)).toMatchObject({
      Competitor: 'Rival Focus',
      'Competitor position': '#9 → #4',
      'Your position': '#5 → #6',
    });
  });

  it('dates the digest window, lists linked apps and caps the apps at ten', () => {
    const report = buildAlert(digestWithGroups, ORIGIN);

    expect(report.window).toEqual(digest.window);
    expect(report.facts.slice(0, 3)).toEqual([
      { label: 'Window', value: '6 to 13 Jul 2026' },
      { label: '', value: 'Linked apps' },
      { label: 'Habit', value: 'vis 61 (-2.5)' },
    ]);
    expect(report.facts[3]).toEqual({
      label: 'App 0',
      value: 'vis 40 (+2.5) · 0 changes · Audit 78 (+3)',
    });
    expect(report.facts.at(-1)).toEqual({ label: '', value: '+2 more' });
    expect(report.link).toEqual({ href: `${ORIGIN}/`, label: 'Open AsoBeast' });
  });

  it('tones each event', () => {
    expect(buildAlert(improved, null).tone).toBe('up');
    expect(buildAlert(firstRanking(), null).tone).toBe('up');
    expect(buildAlert(milestone(), null).tone).toBe('up');
    expect(buildAlert(milestone({ direction: 'left' }), null).tone).toBe(
      'down',
    );
    expect(buildAlert(overtake(), null).tone).toBe('down');
    expect(buildAlert(negative, null).tone).toBe('down');
    expect(buildAlert(metadata, null).tone).toBe('neutral');
  });

  it('lists the facts of a chart move', () => {
    expect(factMap(buildAlert(chartEntered(), null).facts)).toEqual({
      Chart: 'Top free · Productivity (US)',
      From: '>100',
      To: '#7',
      Date: '22 Jul 2026',
    });
    expect(buildAlert(chartMilestone(), null).facts).toEqual([
      { label: 'Chart', value: 'Top free · Productivity (US)' },
      { label: 'Milestone', value: 'entered the top 10' },
      { label: 'From', value: '#14' },
      { label: 'To', value: '#8' },
      { label: 'Date', value: '22 Jul 2026' },
    ]);
  });

  it('tones a chart move by its direction', () => {
    expect(buildAlert(chartEntered(), null).tone).toBe('up');
    expect(buildAlert(chartMilestone(), null).tone).toBe('up');
    expect(buildAlert(chartLeft(), null).tone).toBe('down');
    expect(
      buildAlert(chartMilestone({ direction: 'left', from: 8, to: 12 }), null)
        .tone,
    ).toBe('down');
  });

  it('reports a chart move as a single alert on its app', () => {
    const report = buildAlert(chartEntered(), ORIGIN);

    expect(report.kind).toBe('single');
    expect(report.apps).toHaveLength(1);
    expect(report.apps[0].groups).toEqual([]);
    expect(report.link).toEqual({
      href: `${ORIGIN}/apps/a`,
      label: 'Open app',
    });
  });
});
