import {
  DEFAULT_OCR_LANGUAGES,
  OCR_LANGUAGES,
  OCR_RECIPE_VERSION,
  ocrLanguagesFor,
  ocrRecipe,
} from './ocr-languages';

describe('OCR_LANGUAGES', () => {
  it('lists the thirteen bundled packs', () => {
    expect(OCR_LANGUAGES).toEqual([
      'eng',
      'deu',
      'fra',
      'spa',
      'por',
      'ita',
      'jpn',
      'kor',
      'chi_sim',
      'chi_tra',
      'rus',
      'ara',
      'tha',
    ]);
  });

  it('defaults to every bundled pack', () => {
    expect(DEFAULT_OCR_LANGUAGES).toEqual([...OCR_LANGUAGES]);
  });
});

describe('ocrLanguagesFor', () => {
  it.each([
    ['us', ['eng']],
    ['gb', ['eng']],
    ['jp', ['eng', 'jpn']],
    ['kr', ['eng', 'kor']],
    ['cn', ['eng', 'chi_sim']],
    ['tw', ['eng', 'chi_tra']],
    ['hk', ['eng', 'chi_tra']],
    ['ru', ['eng', 'rus']],
    ['ae', ['eng', 'ara']],
    ['th', ['eng', 'tha']],
    ['de', ['eng', 'deu']],
    ['fr', ['eng', 'fra']],
    ['mx', ['eng', 'spa']],
    ['br', ['eng', 'por']],
    ['it', ['eng', 'ita']],
  ])('reads a %s storefront with %j', (country, expected) => {
    expect(ocrLanguagesFor(country, OCR_LANGUAGES)).toEqual(expected);
  });

  it('reads an unmapped storefront with english alone', () => {
    expect(ocrLanguagesFor('zz', OCR_LANGUAGES)).toEqual(['eng']);
  });

  it('ignores the case of the storefront', () => {
    expect(ocrLanguagesFor('JP', OCR_LANGUAGES)).toEqual(['eng', 'jpn']);
  });

  it('drops a language the operator did not enable', () => {
    expect(ocrLanguagesFor('jp', ['eng'])).toEqual(['eng']);
    expect(ocrLanguagesFor('jp', ['jpn'])).toEqual(['jpn']);
  });

  it('returns nothing when no wanted language is enabled', () => {
    expect(ocrLanguagesFor('us', ['jpn'])).toEqual([]);
  });
});

describe('ocrRecipe', () => {
  it('names the engine version and the languages in order', () => {
    expect(ocrRecipe(['eng', 'jpn'])).toBe(`${OCR_RECIPE_VERSION}:eng+jpn`);
  });

  it('gives different languages different recipes', () => {
    expect(ocrRecipe(['eng'])).not.toBe(ocrRecipe(['eng', 'jpn']));
  });
});
