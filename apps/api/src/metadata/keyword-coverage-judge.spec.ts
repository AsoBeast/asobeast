import { Store } from '@prisma/client';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import {
  judgeKeywordCoverage,
  keywordSurfaces,
} from './keyword-coverage-judge';
import { fieldPhrases } from './listing-surfaces';

const texts = (overrides: Partial<ListingTexts> = {}): ListingTexts => ({
  id: 's',
  title: '',
  subtitle: null,
  summary: null,
  description: '',
  ...overrides,
});

const appStore = { store: Store.APP_STORE, country: 'us' };
const play = { store: Store.GOOGLE_PLAY, country: 'us' };

const sources = (
  listings: [string, ListingTexts][],
  localized: [string, LocalizedTexts[]][] = [],
  fields: { localization: string; phrases: string[] }[] = [],
) => ({
  listings: new Map(listings),
  localized: new Map(localized),
  keywordFields: fieldPhrases(fields),
});

describe('judgeKeywordCoverage', () => {
  it('judges a keyword in the listing of its own market', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'licznik', country: 'pl' },
      sources([
        ['us', texts({ title: 'Focus Timer' })],
        ['pl', texts({ title: 'Licznik' })],
      ]),
    );

    expect(coverage.listingCountry).toBe('pl');
    expect(coverage.uncovered).toBe(false);
  });

  it('falls back to the home listing when its market has none', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'focus timer', country: 'de' },
      sources([['us', texts({ title: 'Focus Timer' })]]),
    );

    expect(coverage.listingCountry).toBe('us');
    expect(coverage.uncovered).toBe(false);
  });

  it('covers an App Store keyword through a captured localization and names it', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'temporizador', country: 'us' },
      sources(
        [['us', texts({ title: 'Focus Timer' })]],
        [
          [
            'us',
            [
              {
                localization: 'es-MX',
                texts: texts({ title: 'Temporizador' }),
              },
            ],
          ],
        ],
      ),
    );

    expect(coverage.fields).toContainEqual({
      field: 'title',
      covered: true,
      localization: 'es-MX',
    });
    expect(coverage.uncovered).toBe(false);
  });

  it('counts the saved keyword field of the home market', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'pomodoro', country: 'us' },
      sources(
        [['us', texts({ title: 'Focus Timer' })]],
        [],
        [{ localization: 'en-US', phrases: ['pomodoro'] }],
      ),
    );

    expect(coverage.fields).toContainEqual({
      field: 'keywordField',
      covered: true,
    });
    expect(coverage.uncovered).toBe(false);
  });

  it('counts the saved keyword field of a localization another market reads', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'skupienie', country: 'pl' },
      sources(
        [
          ['us', texts({ title: 'Focus Timer' })],
          ['pl', texts({ title: 'Focus Timer' })],
        ],
        [],
        [{ localization: 'en-GB', phrases: ['skupienie'] }],
      ),
    );

    expect(coverage.uncovered).toBe(false);
  });

  it('does not count a keyword field that the market does not read', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'skupienie', country: 'pl' },
      sources(
        [
          ['us', texts({ title: 'Focus Timer' })],
          ['pl', texts({ title: 'Focus Timer' })],
        ],
        [],
        [{ localization: 'en-US', phrases: ['skupienie'] }],
      ),
    );

    expect(coverage.fields.map((field) => field.field)).toEqual([
      'title',
      'subtitle',
    ]);
    expect(coverage.uncovered).toBe(true);
  });

  it('judges a Google Play keyword in title, short description and long description', () => {
    const coverage = judgeKeywordCoverage(
      play,
      { text: 'deep work', country: 'us' },
      sources(
        [
          [
            'us',
            texts({
              title: 'Focus Timer',
              summary: 'Pomodoro sessions',
              description: 'Plan your deep work.',
            }),
          ],
        ],
        [],
        [{ localization: 'en-US', phrases: ['deep work'] }],
      ),
    );

    expect(coverage.fields).toEqual([
      { field: 'title', covered: false },
      { field: 'shortDescription', covered: false },
      { field: 'description', covered: true },
    ]);
    expect(coverage.uncovered).toBe(false);
  });

  it('answers uncovered exactly when no field covers the keyword', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'habit planner', country: 'us' },
      sources([
        ['us', texts({ title: 'Focus Timer', subtitle: 'Pomodoro and study' })],
      ]),
    );

    expect(coverage.fields.every((field) => !field.covered)).toBe(true);
    expect(coverage.uncovered).toBe(true);
  });
});

describe('judgeKeywordCoverage on words split across the App Store fields', () => {
  const geoGuess = texts({
    title: 'Where Am I? GeoGuess Map Quiz',
    subtitle: 'World Geography Trivia Game',
  });
  const judge = (
    app: { store: Store; country: string },
    text: string,
    listing: ListingTexts = geoGuess,
    fields: { localization: string; phrases: string[] }[] = [],
  ) =>
    judgeKeywordCoverage(
      app,
      { text, country: 'us' },
      sources([['us', listing]], [], fields),
    );

  it('covers a keyword whose words all sit in the title but not as one phrase', () => {
    expect(judge(appStore, 'geoguess quiz')).toMatchObject({
      uncovered: false,
      wordsSplit: true,
    });
  });

  it('covers a keyword whose words are split between the title and the subtitle', () => {
    expect(judge(appStore, 'geoguess geography')).toMatchObject({
      uncovered: false,
      wordsSplit: true,
    });
  });

  it('covers a keyword with one word only in the saved keyword field', () => {
    expect(
      judge(appStore, 'geoguess atlas', geoGuess, [
        { localization: 'en-US', phrases: ['atlas'] },
      ]),
    ).toMatchObject({ uncovered: false, wordsSplit: true });
  });

  it('keeps a keyword uncovered when one of its words is in no field', () => {
    expect(judge(appStore, 'geoguess atlas')).toMatchObject({
      uncovered: true,
      wordsSplit: false,
    });
  });

  it('answers no split for a phrase one field holds', () => {
    expect(judge(appStore, 'map quiz')).toMatchObject({
      uncovered: false,
      wordsSplit: false,
    });
  });

  it('never combines the words of two localizations', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'geoguess temporizador', country: 'us' },
      sources(
        [['us', geoGuess]],
        [
          [
            'us',
            [
              {
                localization: 'es-MX',
                texts: texts({ title: 'Temporizador' }),
              },
            ],
          ],
        ],
      ),
    );

    expect(coverage).toMatchObject({ uncovered: true, wordsSplit: false });
  });

  it('counts a word split inside one captured localization', () => {
    const coverage = judgeKeywordCoverage(
      appStore,
      { text: 'temporizador estudio', country: 'us' },
      sources(
        [['us', geoGuess]],
        [
          [
            'us',
            [
              {
                localization: 'es-MX',
                texts: texts({
                  title: 'Temporizador Pomodoro',
                  subtitle: 'Para tu estudio',
                }),
              },
            ],
          ],
        ],
      ),
    );

    expect(coverage).toMatchObject({ uncovered: false, wordsSplit: true });
  });

  it('counts no word matched only with its accents ignored', () => {
    expect(
      judge(
        appStore,
        'cafe guide',
        texts({ title: 'Café', subtitle: 'Guide' }),
      ),
    ).toMatchObject({ uncovered: true, wordsSplit: false });
  });

  it('keeps a Google Play keyword uncovered when its words are split', () => {
    expect(
      judge(play, 'geoguess quiz', texts({ title: 'GeoGuess Map Quiz' })),
    ).toMatchObject({ uncovered: true, wordsSplit: false });
  });
});

describe('keywordSurfaces', () => {
  const home = texts({ title: 'Focus Timer', subtitle: 'Study sessions' });

  it.each([
    { market: 'de', listings: ['us', 'de'], judged: 'de' },
    { market: 'de', listings: ['us'], judged: 'us' },
    { market: 'us', listings: ['us'], judged: 'us' },
    { market: 'de', listings: [], judged: 'us' },
  ])(
    'judges a keyword of $market in $judged when the listings are $listings',
    ({ market, listings, judged }) => {
      const judging = keywordSurfaces(
        appStore,
        market,
        sources(listings.map((country) => [country, home])),
      );

      expect(judging.listingCountry).toBe(judged);
    },
  );

  it('answers the surfaces coverage judges in that market', () => {
    const judging = keywordSurfaces(
      appStore,
      'us',
      sources(
        [['us', home]],
        [
          [
            'us',
            [
              {
                localization: 'es-MX',
                texts: texts({ title: 'Temporizador' }),
              },
            ],
          ],
        ],
        [{ localization: 'en-US', phrases: ['pomodoro'] }],
      ),
    );

    expect(judging.surfaces).toEqual([
      { field: 'title', value: 'Focus Timer' },
      { field: 'subtitle', value: 'Study sessions' },
      { field: 'keywordField', value: 'pomodoro' },
    ]);
    expect(judging.localized).toEqual([
      {
        localization: 'es-MX',
        surfaces: [
          { field: 'title', value: 'Temporizador' },
          { field: 'subtitle', value: '' },
        ],
      },
    ]);
  });
});
