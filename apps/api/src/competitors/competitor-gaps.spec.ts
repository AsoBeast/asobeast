import { GapRow } from './competitor-gap-lists';
import {
  bestCompetitor,
  existingGapLists,
  gapKeyword,
} from './competitor-gaps';
import { gapEntry, OTHER, RIVAL, trackedById } from './competitor-gaps.fixture';

const competitors = [
  { id: RIVAL, name: 'Rival' },
  { id: OTHER, name: 'Other' },
];

const listsOf = (entries: GapRow[]) =>
  existingGapLists(
    { competitors, rows: entries.map(({ row }) => row) },
    trackedById(entries),
  );

const textsOf = (rows: { text: string }[]) => rows.map(({ text }) => text);

describe('existingGapLists', () => {
  it('lists a keyword only a competitor ranks for, best opportunity first and null as zero', () => {
    const gaps = listsOf([
      gapEntry({ text: 'low', positions: { [RIVAL]: 5 }, opportunity: 10 }),
      gapEntry({ text: 'none', positions: { [RIVAL]: 7 }, opportunity: null }),
      gapEntry({ text: 'high', positions: { [RIVAL]: 9 }, opportunity: 70 }),
    ]);

    expect(textsOf(gaps.theyRankYouDont)).toEqual(['high', 'low', 'none']);
    expect(gaps.theyRankYouDont[0]).toMatchObject({
      yourPosition: null,
      bestCompetitorPosition: 9,
      bestCompetitorId: RIVAL,
      gap: null,
    });
  });

  it('lists a keyword only the app ranks for', () => {
    const gaps = listsOf([gapEntry({ you: 3, positions: { [RIVAL]: null } })]);

    expect(gaps.youRankTheyDont).toHaveLength(1);
    expect(gaps.youRankTheyDont[0]).toMatchObject({
      yourPosition: 3,
      bestCompetitorPosition: null,
      bestCompetitorId: null,
      gap: null,
    });
  });

  it('lists a keyword a competitor outranks the app on with the distance', () => {
    const gaps = listsOf([gapEntry({ you: 20, positions: { [RIVAL]: 5 } })]);

    expect(gaps.outranked).toEqual([
      expect.objectContaining({ yourPosition: 20, gap: 15 }),
    ]);
  });

  it.each([
    ['the app is ahead', 2, 8],
    ['the positions tie', 5, 5],
    ['nobody ranks', null, null],
  ])('leaves a keyword out of every list when %s', (_, you, rival) => {
    const gaps = listsOf([gapEntry({ you, positions: { [RIVAL]: rival } })]);

    expect(gaps).toEqual({
      theyRankYouDont: [],
      youRankTheyDont: [],
      outranked: [],
    });
  });
});

describe('bestCompetitor', () => {
  it('picks the competitor with the best position', () => {
    const { row } = gapEntry({ positions: { [RIVAL]: 9, [OTHER]: 4 } });

    expect(bestCompetitor(row, competitors)).toEqual({
      id: OTHER,
      position: 4,
    });
  });

  it('keeps the first listed competitor on a tie', () => {
    const { row } = gapEntry({ positions: { [RIVAL]: 6, [OTHER]: 6 } });

    expect(bestCompetitor(row, competitors)?.id).toBe(RIVAL);
  });

  it('answers nothing when no competitor ranks', () => {
    const { row } = gapEntry({ positions: { [RIVAL]: null } });

    expect(bestCompetitor(row, competitors)).toBeUndefined();
  });
});

describe('gapKeyword', () => {
  it('converts the raw difficulty to the 0 to 100 scale', () => {
    const { row, item } = gapEntry({ difficulty: 6 });

    expect(gapKeyword(row, item, undefined, null).difficulty).toBe(60);
  });

  it('keeps a missing difficulty null', () => {
    const { row, item } = gapEntry({ difficulty: null });

    expect(gapKeyword(row, item, undefined, null).difficulty).toBeNull();
  });

  it('answers no volume or opportunity without a tracked item', () => {
    const { row } = gapEntry({ volume: 40, opportunity: 50 });

    expect(gapKeyword(row, undefined, undefined, null)).toMatchObject({
      volume: null,
      opportunity: null,
    });
  });
});
