import {
  actionOpened,
  alpha,
  batch,
  competitorBatch,
  emptySection,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { buildReport } from './build-report';
import {
  competitorsOmission,
  groupLines,
  groupOmission,
  rowText,
} from './report-blocks';

const ORIGIN = 'https://aso.example.com';
const markdown = (label: string, href: string) => `[${label}](${href})`;

describe('rowText', () => {
  it('prints each kind of row', () => {
    expect(
      rowText({
        kind: 'move',
        label: 'memes',
        from: '>200',
        to: '#24',
        note: null,
      }),
    ).toBe('memes  >200 → #24');
    expect(
      rowText({
        kind: 'move',
        label: 'habit tracker',
        from: '#14',
        to: '#8',
        note: 'entered the top 10',
      }),
    ).toBe('habit tracker  #14 → #8 · entered the top 10');
    expect(rowText({ kind: 'text', text: 'a', detail: 'b' })).toBe('a');
    expect(
      rowText({ kind: 'change', field: 'Price', before: '0', after: '2.99' }),
    ).toBe('Price: 0 → 2.99');
    expect(
      rowText({
        kind: 'image',
        field: 'Icon changed',
        beforeUrl: 'x',
        afterUrl: 'y',
      }),
    ).toBe('Icon changed');
  });
});

describe('groupLines', () => {
  it('prints the rows of a group', () => {
    const [drops] = buildReport(batch, null).apps[0].groups;

    expect(groupLines(drops)).toEqual(['game  #3 → #12']);
  });

  it('puts the scope of an action under it', () => {
    const [actions] = buildReport(
      {
        ...batch,
        apps: [{ ...emptySection(alpha.app), actions: [actionOpened] }],
      },
      null,
    ).apps[0].groups;

    expect(groupLines(actions)[1]).toMatch(/^ {2}US · App Store · /);
  });

  it('ends a cut group with its omission', () => {
    const [drops] = buildReport(worstCaseBatch('owned_apps'), ORIGIN).apps[0]
      .groups;

    expect(groupLines(drops).at(-1)).toBe(
      `See all 25: ${ORIGIN}/apps/app_0/keywords`,
    );
  });
});

describe('omissions', () => {
  it('writes the link of a cut group in the format a channel asks for', () => {
    const [drops] = buildReport(worstCaseBatch('owned_apps'), ORIGIN).apps[0]
      .groups;
    const [bare] = buildReport(worstCaseBatch('owned_apps'), null).apps[0]
      .groups;

    expect(groupOmission(drops, markdown)).toBe(
      `[See all 25](${ORIGIN}/apps/app_0/keywords)`,
    );
    expect(groupOmission(bare, markdown)).toBe('+5 more');
  });

  it('says nothing for a group that was not cut', () => {
    const [drops] = buildReport(batch, ORIGIN).apps[0].groups;

    expect(groupOmission(drops)).toBeNull();
  });

  it('links or counts the competitors a report left out', () => {
    expect(
      competitorsOmission(
        buildReport(worstCaseBatch('competitors'), ORIGIN).apps[0],
        markdown,
      ),
    ).toBe(`[See all 12 competitors](${ORIGIN}/apps/app_0/competitors)`);
    expect(
      competitorsOmission(
        buildReport(worstCaseBatch('competitors'), null).apps[0],
      ),
    ).toBe('+2 more competitors');
    expect(
      competitorsOmission(buildReport(competitorBatch, null).apps[0]),
    ).toBeNull();
  });
});
