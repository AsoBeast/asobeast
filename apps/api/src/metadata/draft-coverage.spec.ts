import { Store } from '@prisma/client';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import {
  changeCounts,
  draftedListing,
  draftMarkets,
  PreviewableKeyword,
  previewKeywords,
  previewTargets,
  withDraft,
} from './draft-coverage';
import { CoverageSources } from './keyword-coverage-judge';
import { fieldPhrases } from './listing-surfaces';

const texts = (overrides: Partial<ListingTexts> = {}): ListingTexts => ({
  id: 's',
  title: '',
  subtitle: null,
  summary: null,
  description: '',
  ...overrides,
});

const appStore = {
  store: Store.APP_STORE,
  country: 'us',
  defaultLocalization: null,
};
const play = {
  store: Store.GOOGLE_PLAY,
  country: 'us',
  defaultLocalization: null,
};

const sources = (
  listings: [string, ListingTexts][],
  localized: [string, LocalizedTexts[]][] = [],
  fields: { localization: string; phrases: string[] }[] = [],
): CoverageSources => ({
  listings: new Map(listings),
  localized: new Map(localized),
  keywordFields: fieldPhrases(fields),
});

const keyword = (
  text: string,
  country = 'us',
  bucket: PreviewableKeyword['bucket'] = null,
): PreviewableKeyword => ({
  keywordId: `kw_${text}_${country}`,
  text,
  country,
  bucket,
});

const canada = () =>
  sources(
    [
      ['us', texts({ title: 'Focus Timer' })],
      ['ca', texts({ title: 'Focus Timer', subtitle: 'Habit goals' })],
    ],
    [
      [
        'ca',
        [
          {
            localization: 'fr-CA',
            texts: texts({ title: 'Minuteur', subtitle: 'Objectifs' }),
          },
        ],
      ],
    ],
  );

describe('withDraft on the App Store', () => {
  it('writes the draft title and subtitle over the default listing of a market that reads the localization first', () => {
    const live = sources([['us', texts({ title: 'Focus Timer' })]]);

    const draft = withDraft(
      live,
      appStore,
      { store: Store.APP_STORE, localization: 'en-US' },
      { title: 'Habit Tracker', subtitle: 'Daily goals' },
    );

    expect(draft.listings.get('us')).toMatchObject({
      title: 'Habit Tracker',
      subtitle: 'Daily goals',
      summary: 'Daily goals',
    });
    expect(live.listings.get('us')?.title).toBe('Focus Timer');
    expect(draft.listings).not.toBe(live.listings);
  });

  it('replaces the default listing with a draft of the native home tag', () => {
    const live = sources([['pl', texts({ title: 'Dzienniczek Ucznia' })]]);

    const draft = withDraft(
      live,
      { ...appStore, country: 'pl', defaultLocalization: 'pl' },
      { store: Store.APP_STORE, localization: 'pl' },
      { title: 'Plan lekcji' },
    );

    expect(draft.listings.get('pl')?.title).toBe('Plan lekcji');
    expect(draft.localized.get('pl')).toBeUndefined();
  });

  it('drafts the storefront primary of a native home app over the default listing', () => {
    const polishApp = { ...appStore, country: 'pl', defaultLocalization: 'pl' };
    const live = sources([
      ['pl', texts({ title: 'Dzienniczek Ucznia', subtitle: 'Oceny' })],
    ]);
    const target = { store: Store.APP_STORE, localization: 'en-GB' } as const;

    const draft = withDraft(live, polishApp, target, { keywordField: 'diary' });

    expect(draftedListing(polishApp, draft, target, 'pl')).toMatchObject({
      title: 'Dzienniczek Ucznia',
      subtitle: 'Oceny',
    });
    expect(draft.keywordFields.get('en-GB')).toEqual(['diary']);
    expect(draft.listings.get('pl')?.title).toBe('Dzienniczek Ucznia');
  });

  it('writes an additional localization into the localized texts of a market', () => {
    const draft = withDraft(
      canada(),
      appStore,
      { store: Store.APP_STORE, localization: 'fr-CA' },
      { title: 'Minuteur de focus' },
    );

    expect(draft.listings.get('ca')?.title).toBe('Focus Timer');
    expect(draft.localized.get('ca')).toEqual([
      {
        localization: 'fr-CA',
        texts: expect.objectContaining({
          title: 'Minuteur de focus',
          subtitle: 'Objectifs',
        }) as ListingTexts,
      },
    ]);
  });

  it('adds a localization the market has not captured yet over empty texts', () => {
    const live = sources(
      [
        ['us', texts({ title: 'Focus Timer' })],
        ['ca', texts({ title: 'Focus', subtitle: 'Tracker' })],
      ],
      [['ca', []]],
    );

    const draft = withDraft(
      live,
      appStore,
      { store: Store.APP_STORE, localization: 'fr-CA' },
      { title: 'Habit' },
    );
    const [row] = previewKeywords(
      appStore,
      [keyword('habit tracker', 'ca')],
      live,
      draft,
    );

    expect(draft.localized.get('ca')).toEqual([
      {
        localization: 'fr-CA',
        texts: expect.objectContaining({
          title: 'Habit',
          subtitle: null,
          description: '',
        }) as ListingTexts,
      },
    ]);
    expect(row.change).toBe('missing');
  });

  it('keeps a field the draft leaves out', () => {
    const draft = withDraft(
      sources([['us', texts({ title: 'Focus', subtitle: 'Daily goals' })]]),
      appStore,
      { store: Store.APP_STORE, localization: 'en-US' },
      { title: 'Habit Tracker' },
    );

    expect(draft.listings.get('us')).toMatchObject({
      title: 'Habit Tracker',
      subtitle: 'Daily goals',
    });
  });

  it('replaces the keyword field phrases of the localization', () => {
    const live = sources(
      [['us', texts({ title: 'Focus' })]],
      [],
      [{ localization: 'en-US', phrases: ['habit'] }],
    );
    const target = { store: Store.APP_STORE, localization: 'en-US' } as const;

    expect(
      withDraft(live, appStore, target, {
        keywordField: 'Focus, timer',
      }).keywordFields.get('en-US'),
    ).toEqual(['focus', 'timer']);
    expect(
      withDraft(live, appStore, target, { keywordField: '' }).keywordFields.get(
        'en-US',
      ),
    ).toEqual([]);
    expect(
      withDraft(live, appStore, target, { title: 'Habit' }).keywordFields.get(
        'en-US',
      ),
    ).toEqual(['habit']);
  });

  it('never adds a listings entry for a market without one', () => {
    const live = sources(
      [['us', texts({ title: 'Focus' })]],
      [],
      [{ localization: 'en-US', phrases: ['habit tracker'] }],
    );

    const draft = withDraft(
      live,
      appStore,
      { store: Store.APP_STORE, localization: 'en-GB' },
      { title: 'Habit Tracker UK' },
    );
    const [row] = previewKeywords(
      appStore,
      [keyword('habit tracker', 'gb')],
      live,
      draft,
    );

    expect(draft.listings.has('gb')).toBe(false);
    expect(row.change).toBe('kept');
  });

  it('judges every market that falls back to home with a home localization draft', () => {
    const live = sources([['us', texts({ title: 'Focus Timer' })]]);
    const target = { store: Store.APP_STORE, localization: 'en-US' } as const;

    const markets = draftMarkets(appStore, ['us', 'de'], live, target);
    const [row] = previewKeywords(
      appStore,
      [keyword('habit tracker', 'de')],
      live,
      withDraft(live, appStore, target, { title: 'Habit Tracker' }),
    );

    expect(markets).toEqual({ judged: ['us', 'de'], waiting: [] });
    expect(row.change).toBe('gained');
  });

  it('reports a reader that still falls back to a home listing that does not read the localization as waiting', () => {
    const live = sources([['us', texts({ title: 'Focus Timer' })]]);

    expect(
      draftMarkets(appStore, ['us', 'gb', 'de'], live, {
        store: Store.APP_STORE,
        localization: 'en-GB',
      }),
    ).toEqual({ judged: [], waiting: ['gb', 'de'] });
  });

  it('judges a draft of a home localization its storefront does not list in the home market', () => {
    const offList = {
      ...appStore,
      country: 'de',
      defaultLocalization: 'en-US',
    };
    const live = sources([
      ['de', texts({ title: 'Family Lab' })],
      ['fr', texts({ title: 'Family Lab' })],
    ]);

    expect(
      draftMarkets(offList, ['de', 'fr'], live, {
        store: Store.APP_STORE,
        localization: 'en-US',
      }),
    ).toEqual({ judged: ['de'], waiting: [] });
  });

  it('judges a market that reads the localization once its own listing is captured', () => {
    const live = sources([
      ['us', texts({ title: 'Focus Timer' })],
      ['gb', texts({ title: 'Focus Timer' })],
    ]);

    expect(
      draftMarkets(appStore, ['us', 'gb'], live, {
        store: Store.APP_STORE,
        localization: 'en-GB',
      }),
    ).toEqual({ judged: ['gb'], waiting: [] });
  });

  it('falls back to en-GB for an unlisted storefront as the coverage table does', () => {
    const live = sources([
      ['us', texts({ title: 'Focus Timer' })],
      ['zz', texts({ title: 'Focus Timer' })],
    ]);
    const target = { store: Store.APP_STORE, localization: 'en-GB' } as const;

    const draft = withDraft(live, appStore, target, { title: 'Habit Tracker' });

    expect(draftMarkets(appStore, ['us', 'zz'], live, target).judged).toEqual([
      'zz',
    ]);
    expect(draft.listings.get('zz')?.title).toBe('Habit Tracker');
  });
});

describe('withDraft on Google Play', () => {
  it('writes title, short description and description over the market listing', () => {
    const live = sources([
      [
        'us',
        texts({ title: 'Focus', summary: 'Old summary', description: 'Old' }),
      ],
    ]);

    const draft = withDraft(
      live,
      play,
      { store: Store.GOOGLE_PLAY, country: 'us' },
      { shortDescription: 'Habit tracker', description: 'New' },
    );

    expect(draft.listings.get('us')).toMatchObject({
      title: 'Focus',
      summary: 'Habit tracker',
      description: 'New',
    });
  });

  it('drafts the home listing for a market that falls back to it', () => {
    const live = sources([['us', texts({ title: 'Focus' })]]);
    const target = { store: Store.GOOGLE_PLAY, country: 'de' } as const;

    const draft = withDraft(live, play, target, { title: 'Habit' });

    expect(draft.listings.has('de')).toBe(false);
    expect(draft.listings.get('us')?.title).toBe('Habit');
    expect(draftMarkets(play, ['us', 'de'], live, target)).toEqual({
      judged: ['us', 'de'],
      waiting: [],
    });
  });

  it('judges only the markets that resolve to the drafted listing', () => {
    const live = sources([
      ['us', texts({ title: 'Focus' })],
      ['de', texts({ title: 'Fokus' })],
    ]);

    expect(
      draftMarkets(play, ['us', 'de', 'fr'], live, {
        store: Store.GOOGLE_PLAY,
        country: 'de',
      }),
    ).toEqual({ judged: ['de'], waiting: [] });
  });
});

describe('previewKeywords', () => {
  const live = sources([['us', texts({ title: 'Focus Timer' })]]);
  const target = { store: Store.APP_STORE, localization: 'en-US' } as const;

  it('marks a keyword the draft newly covers as gained', () => {
    const [row] = previewKeywords(
      appStore,
      [keyword('habit tracker')],
      live,
      withDraft(live, appStore, target, { title: 'Habit Tracker' }),
    );

    expect(row).toMatchObject({
      change: 'gained',
      live: { covered: false, wordsSplit: false },
      draft: { covered: true, wordsSplit: false },
    });
    expect(row.draft.fields).toContainEqual({ field: 'title', covered: true });
  });

  it('marks a keyword only the live listing covers as lost', () => {
    const [row] = previewKeywords(
      appStore,
      [keyword('focus timer')],
      live,
      withDraft(live, appStore, target, { title: 'Habit Tracker' }),
    );

    expect(row.change).toBe('lost');
  });

  it('counts words split across the draft fields as covered', () => {
    const habit = sources([['us', texts({ title: 'Habit' })]]);

    const [row] = previewKeywords(
      appStore,
      [keyword('habit tracker')],
      habit,
      withDraft(habit, appStore, target, { subtitle: 'tracker daily' }),
    );

    expect(row).toMatchObject({
      change: 'gained',
      draft: { covered: true, wordsSplit: true },
    });
  });

  it('never combines words of two localizations', () => {
    const live = canada();

    const [row] = previewKeywords(
      appStore,
      [keyword('minuteur tracker', 'ca')],
      live,
      withDraft(
        live,
        appStore,
        { store: Store.APP_STORE, localization: 'en-CA' },
        { subtitle: 'Tracker' },
      ),
    );

    expect(row.change).toBe('missing');
  });

  it('orders lost, gained, missing, kept, then bucket and text', () => {
    const rows = previewKeywords(
      appStore,
      [
        keyword('timer', 'us', 'primary'),
        keyword('sleep sounds', 'us', 'secondary'),
        keyword('focus', 'us', 'primary'),
        keyword('habit', 'us', 'longtail'),
        keyword('daily', 'us', null),
        keyword('alarm', 'us', 'primary'),
        keyword('goals', 'us', 'primary'),
      ],
      sources([['us', texts({ title: 'Focus Timer Goals' })]]),
      withDraft(
        sources([['us', texts({ title: 'Focus Timer Goals' })]]),
        appStore,
        target,
        { title: 'Timer Habit Daily Goals' },
      ),
    );

    expect(rows.map((row) => [row.change, row.text])).toEqual([
      ['lost', 'focus'],
      ['gained', 'habit'],
      ['gained', 'daily'],
      ['missing', 'alarm'],
      ['missing', 'sleep sounds'],
      ['kept', 'goals'],
      ['kept', 'timer'],
    ]);
  });

  it('keeps the keyword class when the keyword carries one', () => {
    const [row] = previewKeywords(
      appStore,
      [{ ...keyword('focus timer'), keywordClass: 'ownBrand' }],
      live,
      live,
    );

    expect(row.keywordClass).toBe('ownBrand');
  });
});

describe('previewTargets', () => {
  const live = sources([['us', texts({ title: 'Focus Timer' })]]);
  const target = { store: Store.APP_STORE, localization: 'en-US' } as const;
  const drafted = withDraft(live, appStore, target, { title: 'Habit Tracker' });

  it('judges each filled slot against the first reader market', () => {
    const targets = previewTargets(
      appStore,
      ['habit tracker', 'focus timer'],
      ['us'],
      { live, draft: drafted },
    );

    expect(targets?.[0]).toMatchObject({
      text: 'habit tracker',
      live: { covered: false },
      draft: { covered: true },
    });
    expect(targets?.[1]).toMatchObject({
      text: 'focus timer',
      live: { covered: true },
      draft: { covered: false },
    });
  });

  it('answers no targets when no market is judged', () => {
    expect(
      previewTargets(appStore, ['habit tracker'], [], { live, draft: drafted }),
    ).toBeUndefined();
  });

  it('answers the position and role of each slot', () => {
    const targets = previewTargets(
      appStore,
      ['habit tracker', '', 'focus timer', 'sleep'],
      ['us'],
      { live, draft: drafted },
    );

    expect(
      targets?.map(({ position, role, text }) => ({ position, role, text })),
    ).toEqual([
      { position: 1, role: 'title', text: 'habit tracker' },
      { position: 3, role: 'subtitle', text: 'focus timer' },
      { position: 4, role: 'extra', text: 'sleep' },
    ]);
  });
});

describe('changeCounts', () => {
  it('counts each change, zero for the ones that never occur', () => {
    expect(
      changeCounts([
        { change: 'gained' },
        { change: 'gained' },
        { change: 'lost' },
      ]),
    ).toEqual({ lost: 1, gained: 2, missing: 0, kept: 0 });
  });
});
