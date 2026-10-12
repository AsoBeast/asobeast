import { KeywordCoverageRow, TrackedKeywordItem } from '@asobeast/shared';
import { suggestKeywordField } from './keyword-field-suggestion';

const item = (
  keywordId: string,
  text: string,
  volume: number,
): TrackedKeywordItem =>
  ({ keywordId, text, volume, relevance: 100 }) as TrackedKeywordItem;

const row = (keywordId: string, uncovered: boolean): KeywordCoverageRow =>
  ({ keywordId, uncovered }) as KeywordCoverageRow;

describe('suggestKeywordField', () => {
  const tracked = [
    item('k1', 'habits', 5),
    item('k2', 'sleep timer', 9),
    item('k3', 'focus', 7),
  ];
  const coverage = [row('k1', true), row('k2', true), row('k3', false)];

  it('packs the uncovered keywords by score, singular', () => {
    expect(suggestKeywordField(tracked, coverage, undefined)).toEqual({
      value: 'sleep timer,habit',
      charactersUsed: 'sleep timer,habit'.length,
      charactersLimit: 100,
      addedTerms: ['sleep timer', 'habit'],
    });
  });

  it('names the localization it was built for', () => {
    expect(suggestKeywordField(tracked, coverage, 'es-MX')).toMatchObject({
      localization: 'es-MX',
    });
  });
});
