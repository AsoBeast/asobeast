import {
  actionOpened,
  alpha,
  batch,
  competitorBatch,
  emptySection,
  worstCaseBatch,
} from '../email-fixtures.fixture';
import { milestone } from '../rank-events.fixture';
import { buildReport } from './build-report';
import { blocksOf, rowText } from './report-blocks';

const ORIGIN = 'https://aso.example.com';

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

describe('blocksOf', () => {
  it('gives each group of an app a block of lines', () => {
    expect(blocksOf(buildReport(batch, null).apps[0])).toEqual([
      { title: 'Rank drops', lines: ['game  #3 → #12'] },
      {
        title: 'Listing changes',
        lines: [`Title: "${'x'.repeat(79)}…" → "short"`],
      },
    ]);
  });

  it('puts the scope of an action under it', () => {
    const [block] = blocksOf(
      buildReport(
        {
          ...batch,
          apps: [{ ...emptySection(alpha.app), actions: [actionOpened] }],
        },
        null,
      ).apps[0],
    );

    expect(block.lines).toHaveLength(2);
    expect(block.lines[1]).toMatch(/^ {2}US · App Store · /);
  });

  it('ends a cut group with its omission', () => {
    const [drops] = blocksOf(
      buildReport(worstCaseBatch('owned_apps'), ORIGIN).apps[0],
    );

    expect(drops.lines.at(-1)).toBe(
      `See all 25: ${ORIGIN}/apps/app_0/keywords`,
    );
  });

  it('gives each competitor a block and notes the ones left out', () => {
    expect(blocksOf(buildReport(competitorBatch, null).apps[0])).toEqual([
      { title: 'Competitor · Charlie', lines: ['Subtitle: "a" → "b"'] },
    ]);
    expect(
      blocksOf(buildReport(worstCaseBatch('competitors'), null).apps[0]).at(-1),
    ).toEqual({ title: '', lines: ['+2 more competitors'] });
  });

  it('prints a milestone with its note', () => {
    const [block] = blocksOf(
      buildReport(
        {
          ...batch,
          apps: [{ ...emptySection(alpha.app), rankMilestones: [milestone()] }],
        },
        null,
      ).apps[0],
    );

    expect(block).toEqual({
      title: 'Milestones',
      lines: ['habit tracker  #14 → #8 · entered the top 10'],
    });
  });
});
