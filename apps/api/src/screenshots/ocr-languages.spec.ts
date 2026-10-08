import {
  DEFAULT_OCR_LANGUAGES,
  OCR_LANGUAGES,
  OCR_RECIPE_VERSION,
  ocrLanguagesFor,
  ocrRecipe,
} from './ocr-languages';

describe('OCR_LANGUAGES', () => {
  it('lists the fourteen bundled packs', () => {
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
      'pol',
    ]);
  });

  it('defaults to every bundled pack', () => {
    expect(DEFAULT_OCR_LANGUAGES).toEqual([...OCR_LANGUAGES]);
  });
});

describe('ocrLanguagesFor polish', () => {
  it('reads the polish storefront in english and polish', () => {
    expect(ocrLanguagesFor('pl', [...OCR_LANGUAGES])).toEqual(['eng', 'pol']);
  });

  it('reads the polish storefront in english only when polish is not enabled', () => {
    expect(ocrLanguagesFor('pl', ['eng'])).toEqual(['eng']);
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

describe('ocrLanguagesFor a localized listing', () => {
  const all = [...OCR_LANGUAGES];

  it('reads a localization with its own pack', () => {
    expect(ocrLanguagesFor('sg', all, 'zh-Hans')).toEqual(['eng', 'chi_sim']);
    expect(ocrLanguagesFor('be', all, 'fr')).toEqual(['eng', 'fra']);
    expect(ocrLanguagesFor('bz', all, 'es-MX')).toEqual(['eng', 'spa']);
    expect(ocrLanguagesFor('ca', all, 'fr-CA')).toEqual(['eng', 'fra']);
    expect(ocrLanguagesFor('ua', all, 'ru')).toEqual(['eng', 'rus']);
  });

  it('reads the polish localization of a polish storefront in english and polish', () => {
    expect(ocrLanguagesFor('pl', all, 'pl')).toEqual(['eng', 'pol']);
    expect(ocrLanguagesFor('pl', ['eng'], 'pl')).toEqual(['eng']);
  });

  it('reads a localization without a bundled pack in english only', () => {
    expect(ocrLanguagesFor('be', all, 'nl')).toEqual(['eng']);
    expect(ocrLanguagesFor('cz', all, 'cs')).toEqual(['eng']);
  });

  it('never reads a pack that is not enabled', () => {
    expect(ocrLanguagesFor('sg', ['eng'], 'zh-Hans')).toEqual(['eng']);
  });

  it('reads the default listing as before', () => {
    expect(ocrLanguagesFor('sa', all)).toEqual(['eng', 'ara']);
    expect(ocrLanguagesFor('sa', all, null)).toEqual(['eng', 'ara']);
  });
});
