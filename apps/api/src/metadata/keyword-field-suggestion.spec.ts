import { KeywordCoverageRow, TrackedKeywordItem } from '@asobeast/shared';
import { suggestKeywordField } from './keyword-field-suggestion';

const item = (
  keywordId: string,
  text: string,
  volume: number,
  keywordClass?: TrackedKeywordItem['keywordClass'],
): TrackedKeywordItem =>
  ({
    keywordId,
    text,
    volume,
    relevance: 100,
    keywordClass,
  }) as TrackedKeywordItem;

const row = (keywordId: string, uncovered: boolean): KeywordCoverageRow =>
  ({ keywordId, uncovered }) as KeywordCoverageRow;

describe('suggestKeywordField', () => {
  const tracked = [
    item('k1', 'habits', 5),
    item('k2', 'sleep timer', 9),
    item('k3', 'focus', 7),
    item('k5', 'habit tracker', 3),
  ];
  const coverage = [
    row('k1', true),
    row('k2', true),
    row('k3', false),
    row('k5', false),
  ];

  it('writes a plural as its tracked singular', () => {
    expect(suggestKeywordField(tracked, coverage, undefined)).toEqual({
      value: 'sleep timer,habit',
      charactersUsed: 'sleep timer,habit'.length,
      charactersLimit: 100,
      addedTerms: ['sleep timer', 'habit'],
    });
  });

  it('keeps a lone plural as tracked', () => {
    expect(
      suggestKeywordField(
        [item('k1', 'habits', 5)],
        [row('k1', true)],
        undefined,
      ).addedTerms,
    ).toEqual(['habits']);
  });

  it('never cuts a word that is not a plural', () => {
    const words = [
      'focus timer',
      'atlas quiz',
      'bonus',
      'status',
      'canvas',
      'news',
      'glasses',
      'series',
    ];
    const suggestion = suggestKeywordField(
      words.map((text, index) => item(`w${index}`, text, 20 - index)),
      words.map((_, index) => row(`w${index}`, true)),
      'en-US',
    );

    expect(suggestion.addedTerms).toEqual(words);
    for (const cut of [
      'focu',
      'atla',
      'bonu',
      'statu',
      'canva',
      'new',
      'glasse',
      'serie',
    ]) {
      expect(suggestion.value.split(/[ ,]/)).not.toContain(cut);
    }
  });

  it('keeps news when new is tracked too', () => {
    expect(
      suggestKeywordField(
        [item('k1', 'news app', 9), item('k2', 'new games', 4)],
        [row('k1', true), row('k2', false)],
        'en-US',
      ).addedTerms,
    ).toEqual(['news app']);
  });

  it('keeps a short word whole when its stem is tracked', () => {
    expect(
      suggestKeywordField(
        [item('k1', 'ios widgets', 9), item('k2', 'io games', 4)],
        [row('k1', true), row('k2', false)],
        'en-US',
      ).addedTerms,
    ).toEqual(['ios widgets']);
  });

  it('never suggests a competitor brand', () => {
    expect(
      suggestKeywordField(
        [...tracked, item('k4', 'geoguessr', 50, 'competitorBrand')],
        [...coverage, row('k4', true)],
        undefined,
      ).addedTerms,
    ).toEqual(['sleep timer', 'habit']);
  });

  it('suggests a brand the owner marked generic', () => {
    expect(
      suggestKeywordField(
        [item('k4', 'geoguessr', 50, 'generic')],
        [row('k4', true)],
        undefined,
      ).addedTerms,
    ).toEqual(['geoguessr']);
  });

  it('names the localization it was built for', () => {
    expect(suggestKeywordField(tracked, coverage, 'es-MX')).toMatchObject({
      localization: 'es-MX',
    });
  });

  it('keeps the words of a localization that is not english as they are', () => {
    const german = [item('k1', 'yoga kurs', 9)];

    expect(
      suggestKeywordField(german, [row('k1', true)], 'de').addedTerms,
    ).toEqual(['yoga kurs']);
  });
});
