import { detectionCandidates } from './localization-candidates';

const input = (
  overrides: Partial<Parameters<typeof detectionCandidates>[0]> = {},
): Parameters<typeof detectionCandidates>[0] => ({
  home: 'us',
  markets: ['us'],
  listedMarkets: new Set(['us']),
  shipped: new Set(['en-US']),
  languages: null,
  ...overrides,
});

const localizationsOf = (
  candidates: ReturnType<typeof detectionCandidates>,
): string[] => candidates.map(({ localization }) => localization);

const US_ADDITIONAL = [
  'ar',
  'zh-Hans',
  'zh-Hant',
  'fr',
  'ko',
  'pt-BR',
  'ru',
  'es-MX',
  'vi',
];

describe('detectionCandidates', () => {
  it('offers every localization a listed market reads that the app does not ship', () => {
    const candidates = detectionCandidates(input());

    expect(localizationsOf(candidates)).toEqual(US_ADDITIONAL);
    expect(candidates.every(({ country }) => country === 'us')).toBe(true);
  });

  it('leaves out what the app ships', () => {
    const candidates = detectionCandidates(
      input({ shipped: new Set(['en-US', 'es-MX', 'fr']) }),
    );

    expect(localizationsOf(candidates)).toEqual(
      US_ADDITIONAL.filter((tag) => tag !== 'es-MX' && tag !== 'fr'),
    );
  });

  it('keeps only the languages the home listing declares', () => {
    expect(
      localizationsOf(
        detectionCandidates(input({ languages: ['EN', 'ES', 'FR'] })),
      ),
    ).toEqual(['fr', 'es-MX']);
  });

  it('matches the language of a regional tag', () => {
    expect(
      localizationsOf(detectionCandidates(input({ languages: ['ZH', 'PT'] }))),
    ).toEqual(['zh-Hans', 'zh-Hant', 'pt-BR']);
  });

  it('reads the norwegian bokmal code apple declares as norwegian', () => {
    expect(
      detectionCandidates(
        input({
          home: 'no',
          markets: ['no'],
          listedMarkets: new Set(['no']),
          shipped: new Set(),
          languages: ['EN', 'NB'],
        }),
      ),
    ).toEqual([{ localization: 'no', country: 'no' }]);
  });

  it('keeps every candidate when no languages are known', () => {
    expect(
      localizationsOf(detectionCandidates(input({ languages: null }))),
    ).toEqual(US_ADDITIONAL);
    expect(detectionCandidates(input({ languages: [] }))).toEqual([]);
  });

  it('probes in the home market first, then in code order', () => {
    const candidates = detectionCandidates(
      input({
        markets: ['us', 'mx', 'au'],
        listedMarkets: new Set(['us', 'mx', 'au']),
      }),
    );

    expect(candidates).toContainEqual({ localization: 'es-MX', country: 'us' });
    expect(candidates).toContainEqual({ localization: 'en-GB', country: 'au' });
  });

  it('skips a market without a stored default listing', () => {
    expect(
      detectionCandidates(
        input({
          markets: ['us', 'mx'],
          listedMarkets: new Set(['mx']),
          shipped: new Set(),
        }),
      ),
    ).toEqual([{ localization: 'en-GB', country: 'mx' }]);
  });

  it('drops a localization no listed market can probe', () => {
    expect(detectionCandidates(input({ listedMarkets: new Set() }))).toEqual(
      [],
    );
  });

  it('never probes the default localization of a market in that market', () => {
    expect(
      detectionCandidates(
        input({
          home: 'mx',
          markets: ['mx'],
          listedMarkets: new Set(['mx']),
          shipped: new Set(),
        }),
      ),
    ).toEqual([{ localization: 'en-GB', country: 'mx' }]);
  });

  it('lists each localization once', () => {
    const candidates = detectionCandidates(
      input({
        home: 'mx',
        markets: ['mx', 'au'],
        listedMarkets: new Set(['mx', 'au']),
        shipped: new Set(),
      }),
    );

    expect(
      localizationsOf(candidates).filter((tag) => tag === 'en-GB'),
    ).toHaveLength(1);
  });
});
