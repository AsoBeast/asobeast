import { Store } from '@prisma/client';
import {
  breakdownApp,
  BreakdownListing,
  BreakdownSubject,
  breakdownTerms,
  sortBreakdown,
} from './keyword-breakdown';

const listing = (over: Partial<BreakdownListing> = {}): BreakdownListing => ({
  country: 'us',
  title: 'Focus Timer: Pomodoro',
  subtitle: 'Study and deep work',
  summary: null,
  ratingAvg: 4.6,
  ratingCount: 1200,
  ...over,
});

const subject = (over: Partial<BreakdownSubject> = {}): BreakdownSubject => ({
  appId: 'app1',
  name: 'Focus Timer',
  iconUrl: null,
  isYou: true,
  position: 3,
  listing: listing(),
  ...over,
});

describe('breakdownTerms', () => {
  it('splits a keyword into its distinct normalized words', () => {
    expect(breakdownTerms('Focus  timer, FOCUS')).toEqual(['focus', 'timer']);
  });
});

describe('breakdownApp', () => {
  it('finds the whole phrase in the title', () => {
    const app = breakdownApp(subject(), Store.APP_STORE, 'focus timer');

    expect(app.fields).toEqual([
      {
        field: 'title',
        value: 'Focus Timer: Pomodoro',
        phrase: true,
        terms: ['focus', 'timer'],
      },
      {
        field: 'subtitle',
        value: 'Study and deep work',
        phrase: false,
        terms: [],
      },
    ]);
    expect(app.matchedTerms).toBe(2);
  });

  it('counts the words a listing spreads over its title and subtitle', () => {
    const app = breakdownApp(subject(), Store.APP_STORE, 'study timer app');

    expect(app.fields.map((field) => field.phrase)).toEqual([false, false]);
    expect(app.fields.map((field) => field.terms)).toEqual([
      ['timer'],
      ['study'],
    ]);
    expect(app.matchedTerms).toBe(2);
  });

  it('does not match a word inside a longer word', () => {
    const app = breakdownApp(subject(), Store.APP_STORE, 'time');

    expect(app.matchedTerms).toBe(0);
  });

  it('reads the short description on Google Play', () => {
    const app = breakdownApp(
      subject({
        listing: listing({ subtitle: null, summary: 'Pomodoro app' }),
      }),
      Store.GOOGLE_PLAY,
      'pomodoro app',
    );

    expect(app.fields.map((field) => field.field)).toEqual([
      'title',
      'shortDescription',
    ]);
    expect(app.fields[1].phrase).toBe(true);
  });

  it('leaves an empty field unmatched', () => {
    const app = breakdownApp(
      subject({ listing: listing({ subtitle: null }) }),
      Store.APP_STORE,
      'study',
    );

    expect(app.fields[1]).toEqual({
      field: 'subtitle',
      value: null,
      phrase: false,
      terms: [],
    });
  });

  it('carries the market of the listing it read and its ratings', () => {
    const app = breakdownApp(
      subject({ listing: listing({ country: 'de' }) }),
      Store.APP_STORE,
      'focus',
    );

    expect(app.listingCountry).toBe('de');
    expect(app.ratingAvg).toBe(4.6);
    expect(app.ratingCount).toBe(1200);
  });

  it('reports an app with no captured listing as unread', () => {
    const app = breakdownApp(
      subject({ listing: null }),
      Store.APP_STORE,
      'focus',
    );

    expect(app.listingCountry).toBeNull();
    expect(app.fields).toEqual([]);
    expect(app.matchedTerms).toBe(0);
  });
});

describe('sortBreakdown', () => {
  it('puts you first, then competitors by position with unranked last', () => {
    const apps = [
      subject({ appId: 'unranked', isYou: false, position: null }),
      subject({ appId: 'ninth', isYou: false, position: 9 }),
      subject({ appId: 'you', isYou: true, position: 40 }),
      subject({ appId: 'second', isYou: false, position: 2 }),
    ].map((entry) => breakdownApp(entry, Store.APP_STORE, 'focus'));

    expect(sortBreakdown(apps).map((app) => app.appId)).toEqual([
      'you',
      'second',
      'ninth',
      'unranked',
    ]);
  });
});
