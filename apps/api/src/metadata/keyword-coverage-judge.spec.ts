import { Store } from '@prisma/client';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import { judgeKeywordCoverage } from './keyword-coverage-judge';
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
