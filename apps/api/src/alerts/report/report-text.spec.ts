import {
  actionOpened,
  batch,
  competitorBatch,
  dropped,
  metadata,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildAlert } from './build-alert';
import { buildReport } from './build-report';
import { reportText } from './report-text';

const ORIGIN = 'https://aso.example.com';

describe('reportText', () => {
  it('prints the daily report with its groups indented under each app', () => {
    expect(reportText(buildReport(batch, ORIGIN))).toBe(
      [
        'Daily app update: 3 changes across 2 apps',
        '22 Jul 2026',
        '',
        'Alpha',
        `App Store · US · ${ORIGIN}/apps/a`,
        '',
        '  Rank drops',
        '    game  #3 → #12',
        '',
        '  Listing changes',
        `    Title: "${'x'.repeat(79)}…" → "short"`,
        '',
        'Bravo',
        `Google Play · GB · ${ORIGIN}/apps/b`,
        '',
        '  New in the top 10',
        '    planner · #4 Newcomer',
      ].join('\n'),
    );
  });

  it('nests each competitor under the primary app', () => {
    expect(reportText(buildReport(competitorBatch, null))).toBe(
      [
        'Competitor watch: 1 change across 1 competitor',
        '22 Jul 2026',
        '',
        'Alpha',
        'Your app · App Store · US',
        '',
        '  Charlie',
        '  Competitor · App Store · US',
        '',
        '    Listing changes',
        '      Subtitle: "a" → "b"',
      ].join('\n'),
    );
  });

  it('ends a cut group with a link to the rest, or a count without one', () => {
    const linked = reportText(
      buildReport(worstCaseBatch('owned_apps'), ORIGIN),
    );
    const bare = reportText(buildReport(worstCaseBatch('owned_apps'), null));

    expect(linked).toContain(`    See all 25: ${ORIGIN}/apps/app_0/keywords`);
    expect(linked).toContain(`+2 more apps · Open AsoBeast: ${ORIGIN}/`);
    expect(bare).toContain('    +5 more');
    expect(bare.endsWith('+2 more apps')).toBe(true);
    expect(bare).not.toContain('more lines');
  });

  it('links or counts the competitors a report left out', () => {
    expect(
      reportText(buildReport(worstCaseBatch('competitors'), ORIGIN)),
    ).toContain(`  See all 12 competitors: ${ORIGIN}/apps/app_0/competitors`);
    expect(
      reportText(buildReport(worstCaseBatch('competitors'), null)),
    ).toContain('  +2 more competitors');
  });

  it('prints an icon change as words', () => {
    expect(
      reportText(
        buildReport(
          { ...batch, apps: [{ ...batch.apps[0], changes: [metadata] }] },
          null,
        ),
      ),
    ).toContain('    Icon changed');
  });

  it('prints a single alert as its sentence, facts, link and instant', () => {
    expect(reportText(buildAlert(dropped, ORIGIN, false))).toBe(
      [
        'My App dropped from #4 to #12 for "fitness app" in US',
        '',
        'Keyword: fitness app (US)',
        'From: #4',
        'To: #12',
        'Alert threshold: 5',
        `Open app: ${ORIGIN}/apps/app_1`,
        '',
        '11 Jul 2026, 00:00 UTC',
      ].join('\n'),
    );
  });

  it('prints the action link of an action without an origin', () => {
    expect(reportText(buildAlert(actionOpened, null, false))).toContain(
      `Open the action: ${actionOpened.link}`,
    );
  });

  it('prints a metadata change without any url', () => {
    const text = reportText(buildAlert(metadata, null, false));

    expect(text).toContain('Icon: Changed');
    expect(text).not.toContain('http');
  });
});
