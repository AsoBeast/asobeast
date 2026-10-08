import { appStoreContext, keyword } from '../audit-context.fixture';
import { captionKeywordsCheck } from './caption-keyword-check';

const keywords = [
  keyword('geo quiz', 'primary', 90),
  keyword('world map', 'primary', 80),
  keyword('capital cities', 'secondary', 70),
];

describe('captionKeywordsCheck', () => {
  it.each([
    [
      ['A geo quiz for everyone', 'Learn the world map', 'All capital cities'],
      10,
    ],
    [['A geo quiz', 'Learn the world map'], 7],
    [['A geo quiz'], 4],
    [['Nothing here'], 0],
  ])('scores %j as %i', (texts, score) => {
    const result = captionKeywordsCheck(
      appStoreContext({ keywords }),
      texts,
      'keywords',
    );

    expect(result.score).toBe(score);
  });

  it('is unanswered with nothing tracked and points at the keywords', () => {
    const result = captionKeywordsCheck(
      appStoreContext(),
      ['anything'],
      'keywords',
    );

    expect(result.score).toBeNull();
    expect(result.unlock?.kind).toBe('keywords');
  });

  it('keeps the id, label and weight whatever the source', () => {
    const fromText = captionKeywordsCheck(
      appStoreContext({ keywords }),
      ['a'],
      'keywords',
    );
    const fromModel = captionKeywordsCheck(
      appStoreContext({ keywords }),
      ['a'],
      'ai',
    );

    expect([fromText.id, fromText.label, fromText.weight]).toEqual([
      'screenshots-caption-keywords',
      'Keywords in captions',
      2,
    ]);
    expect([fromModel.id, fromModel.label, fromModel.weight]).toEqual([
      fromText.id,
      fromText.label,
      fromText.weight,
    ]);
  });

  it('marks the model source as an ai check and the text source as an automatic one', () => {
    expect(
      captionKeywordsCheck(appStoreContext({ keywords }), ['a'], 'ai').kind,
    ).toBe('ai');
    expect(
      captionKeywordsCheck(appStoreContext({ keywords }), ['a'], 'keywords')
        .kind,
    ).toBe('auto');
  });
});
