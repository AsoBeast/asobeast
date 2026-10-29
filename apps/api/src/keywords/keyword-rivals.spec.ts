import { competitorsInTop10 } from './keyword-rivals';
import { KeywordSerpDays } from './keyword-serp-days';

const TODAY = '2026-10-28';
const COMPETITORS = new Set(['c1', 'c2']);

const daysOf = (byDate: Record<string, string[]>): KeywordSerpDays =>
  new Map([['k1', new Map(Object.entries(byDate))]]);

describe('competitorsInTop10', () => {
  it.each([
    ['the newest day holds two competitors', { [TODAY]: ['x', 'c1', 'c2'] }, 2],
    [
      'only the newest day counts',
      { '2026-10-27': ['c1', 'c2'], [TODAY]: ['x', 'c1'] },
      1,
    ],
    ['yesterday is fresh', { '2026-10-27': ['c1'] }, 1],
    ['two days old is stale', { '2026-10-26': ['c1'] }, null],
    [
      'the app itself and strangers are not competitors',
      { [TODAY]: ['me', 'x', 'y'] },
      0,
    ],
    ['a repeated store id counts once', { [TODAY]: ['c1', 'c1'] }, 1],
  ])('%s', (_case, byDate, expected) => {
    expect(
      competitorsInTop10(daysOf(byDate), COMPETITORS, TODAY).get('k1'),
    ).toBe(expected);
  });

  it('leaves a keyword with no days out of the map', () => {
    expect(competitorsInTop10(new Map(), COMPETITORS, TODAY)).toEqual(
      new Map(),
    );
  });

  it('answers nothing when the app has no competitor', () => {
    expect(
      competitorsInTop10(daysOf({ [TODAY]: ['c1'] }), new Set(), TODAY),
    ).toEqual(new Map());
  });
});
