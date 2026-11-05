import { KeywordClass } from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { BrandKeywords } from './brand-keywords';

const item = (
  keywordId: string,
  keywordClass?: KeywordClass,
): [string, KeywordClass | undefined] => [keywordId, keywordClass];

const build = (items: ReturnType<typeof item>[]) => {
  const keywords = {
    keywordClasses: jest.fn().mockResolvedValue(new Map(items)),
  };
  return {
    keywords,
    brands: new BrandKeywords(keywords as unknown as KeywordsService),
  };
};

describe('BrandKeywords.excluded', () => {
  it('leaves out the keywords classed as a brand', async () => {
    const { brands } = build([
      item('own', 'ownBrand'),
      item('rival', 'competitorBrand'),
      item('plain', 'generic'),
    ]);

    expect(await brands.excluded('app', undefined)).toEqual(
      new Set(['own', 'rival']),
    );
  });

  it('answers nothing when no keyword carries a class', async () => {
    const { brands } = build([item('a'), item('b')]);

    expect(await brands.excluded('app', undefined)).toBeNull();
  });

  it('trusts no partial answer', async () => {
    const { brands } = build([item('a', 'ownBrand'), item('b')]);

    expect(await brands.excluded('app', undefined)).toBeNull();
  });

  it('leaves nothing out of an app without keywords', async () => {
    const { brands } = build([]);

    expect(await brands.excluded('app', undefined)).toEqual(new Set());
  });

  it('reads the classes of the market asked for', async () => {
    const { brands, keywords } = build([]);

    await brands.excluded('app', 'de');

    expect(keywords.keywordClasses).toHaveBeenCalledWith('app', 'de');
  });
});
