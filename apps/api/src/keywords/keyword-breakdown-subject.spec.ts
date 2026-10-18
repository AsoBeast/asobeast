import { Store } from '@prisma/client';
import { type KeywordBreakdownApp, readLocalizations } from '@asobeast/shared';
import type { ListingTexts } from '../apps/listing-texts';
import { keywordWords } from './keyword-breakdown-fields';
import {
  breakdownApp,
  type BreakdownContext,
  type BreakdownSubject,
  sortBreakdown,
} from './keyword-breakdown-subject';

const texts = (overrides: Partial<ListingTexts> = {}): ListingTexts => ({
  id: 'snap',
  title: '',
  subtitle: null,
  summary: null,
  description: '',
  ...overrides,
});

const subject = (
  overrides: Partial<BreakdownSubject> = {},
): BreakdownSubject => ({
  id: 'you',
  name: 'Habit Pro',
  iconUrl: null,
  isYou: true,
  listing: {
    texts: texts({ title: 'Habit Tracker' }),
    country: 'us',
    capturedAt: new Date('2026-10-17T03:00:00Z'),
    ratingAvg: 4.6,
    ratingCount: 120,
  },
  localized: [],
  fields: new Map(),
  shipped: ['en-US'],
  ranking: null,
  ...overrides,
});

const context = (
  overrides: Partial<BreakdownContext> = {},
): BreakdownContext => {
  const keyword = overrides.keyword ?? 'habit tracker';
  return {
    store: Store.APP_STORE,
    market: 'us',
    home: 'us',
    keyword,
    words: keywordWords(keyword),
    ...overrides,
  };
};

const fieldOf = (app: KeywordBreakdownApp, localization: string | null) =>
  app.listings.find((listing) => listing.localization === localization);

describe('breakdownApp', () => {
  it('judges the default listing and each captured localization on its own', () => {
    const app = breakdownApp(
      subject({
        localized: [
          { localization: 'es-MX', texts: texts({ title: 'Hábitos' }) },
        ],
      }),
      context(),
    );
    expect(
      app.listings.map(({ localization, role, placement }) => ({
        localization,
        role,
        placement,
      })),
    ).toEqual([
      { localization: 'en-US', role: 'default', placement: 'title' },
      { localization: 'es-MX', role: 'additional', placement: 'none' },
    ]);
  });

  it('never combines words across localizations', () => {
    const app = breakdownApp(
      subject({
        listing: {
          ...subject().listing!,
          texts: texts({ title: 'Habit' }),
        },
        localized: [
          {
            localization: 'es-MX',
            texts: texts({ title: 'Diario', subtitle: 'tracker' }),
          },
        ],
      }),
      context(),
    );
    expect(app.listings.map((listing) => listing.placement)).toEqual([
      'partial',
      'partial',
    ]);
    expect(app.placement).toBe('partial');
  });

  it('gives your app its saved keyword field', () => {
    const app = breakdownApp(
      subject({ fields: new Map([['en-US', ['habit', 'tracker']]]) }),
      context(),
    );
    const field = fieldOf(app, 'en-US')?.fields.find(
      (each) => each.field === 'keywordField',
    );
    expect(field?.phrase).toBe(true);
    expect(field?.segments?.map((segment) => segment.text).join('')).toBe(
      'habit, tracker',
    );
  });

  it('never gives a competitor a keyword field', () => {
    const app = breakdownApp(
      subject({ isYou: false, fields: new Map() }),
      context(),
    );
    expect(
      app.listings.flatMap((listing) =>
        listing.fields.map((field) => field.field),
      ),
    ).toEqual(['title', 'subtitle']);
  });

  it('shows your empty home keyword field', () => {
    const field = fieldOf(
      breakdownApp(subject(), context()),
      'en-US',
    )?.fields.find((each) => each.field === 'keywordField');
    expect(field?.words.every((word) => word.match === 'none')).toBe(true);
    expect(field?.segments).toEqual([]);
  });

  it('keeps the Google Play description without its text', () => {
    const app = breakdownApp(
      subject({
        listing: {
          ...subject().listing!,
          texts: texts({
            title: 'Habit',
            summary: 'Daily tracker',
            description: 'The habit tracker you need',
          }),
        },
      }),
      context({ store: Store.GOOGLE_PLAY }),
    );
    expect(app.listings).toHaveLength(1);
    const [listing] = app.listings;
    expect(listing.localization).toBeNull();
    expect(listing.role).toBeNull();
    expect(listing.fields.map((field) => field.field)).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);
    expect(listing.fields[2].segments).toBeNull();
    expect(listing.fields[2].phrase).toBe(true);
    expect(app.unread).toEqual([]);
  });

  it('lists the localizations it could not read', () => {
    const rival = breakdownApp(subject({ isYou: false }), context()).unread;
    expect(rival).toContain('es-MX');
    expect(rival).toEqual(readLocalizations('us').slice(1));
    expect(breakdownApp(subject(), context()).unread).toEqual([]);
    expect(
      breakdownApp(subject({ shipped: ['en-US', 'es-MX'] }), context()).unread,
    ).toEqual(['es-MX']);
    expect(
      breakdownApp(
        subject({
          shipped: ['en-US', 'es-MX'],
          localized: [{ localization: 'es-MX', texts: texts() }],
        }),
        context(),
      ).unread,
    ).toEqual([]);
  });

  it('falls back to the home listing', () => {
    const app = breakdownApp(subject(), context({ market: 'de' }));
    expect(app.listingCountry).toBe('us');
    expect(app.listings[0]).toMatchObject({
      localization: 'en-US',
      role: 'default',
    });
    expect(app.rating).toEqual({ average: 4.6, count: 120, country: 'us' });
  });

  it('answers no listing', () => {
    const you = breakdownApp(subject({ listing: null }), context());
    expect(you.listings).toHaveLength(1);
    expect(you.listings[0].fields.map((field) => field.field)).toEqual([
      'keywordField',
    ]);
    expect(you).toMatchObject({
      listingCountry: null,
      capturedAt: null,
      rating: null,
    });
    const rival = breakdownApp(
      subject({ isYou: false, listing: null }),
      context(),
    );
    expect(rival.listings).toEqual([]);
    expect(rival.placement).toBe('none');
  });

  it('answers no rating when the listing has none', () => {
    const app = breakdownApp(
      subject({
        listing: { ...subject().listing!, ratingAvg: null, ratingCount: null },
      }),
      context(),
    );
    expect(app.rating).toBeNull();
  });

  it('answers the three ranking states', () => {
    expect(breakdownApp(subject(), context()).ranking).toBeNull();
    const date = new Date('2026-10-18T00:00:00Z');
    expect(
      breakdownApp(
        subject({ ranking: { position: null, depth: 200, date } }),
        context(),
      ).ranking,
    ).toEqual({ position: null, depth: 200, date: '2026-10-18' });
    expect(
      breakdownApp(
        subject({ ranking: { position: 4, depth: 100, date } }),
        context(),
      ).ranking,
    ).toEqual({ position: 4, depth: 100, date: '2026-10-18' });
    expect(breakdownApp(subject(), context()).capturedAt).toBe(
      '2026-10-17T03:00:00.000Z',
    );
  });
});

describe('sortBreakdown', () => {
  it('puts you first, then position, not found, never checked, then name', () => {
    const date = new Date('2026-10-18T00:00:00Z');
    const app = (
      id: string,
      position: number | null | undefined,
      isYou = false,
    ) =>
      breakdownApp(
        subject({
          id,
          name: id,
          isYou,
          ranking:
            position === undefined ? null : { position, depth: 200, date },
        }),
        context(),
      );
    const sorted = sortBreakdown([
      app('zeta', undefined),
      app('beta', null),
      app('alpha', undefined),
      app('gamma', 9),
      app('delta', 2),
      app('you', 40, true),
    ]);
    expect(sorted.map((each) => each.appId)).toEqual([
      'you',
      'delta',
      'gamma',
      'beta',
      'alpha',
      'zeta',
    ]);
  });
});
