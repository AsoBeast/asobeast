import type { LocalizationReader } from '@asobeast/shared';
import { pairKey } from './keyword-import';
import { TrackingLookup, TrackingState } from './keyword-import-plan';
import { planFieldSave } from './keyword-field-save-plan';

const US: LocalizationReader = {
  country: 'us',
  role: 'additional',
  home: true,
};
const MX: LocalizationReader = { country: 'mx', role: 'default', home: false };

const lookup = (entries: Record<string, TrackingState>): TrackingLookup =>
  new Map(Object.entries(entries));

const plan = (overrides: Partial<Parameters<typeof planFieldSave>[0]> = {}) =>
  planFieldSave({
    stored: [],
    phrases: [],
    readers: [US],
    tracking: new Map(),
    requestsPerKeyword: 1,
    ...overrides,
  });

describe('planFieldSave', () => {
  it('reports what the field adds and drops against the stored field, in typed order', () => {
    expect(
      plan({
        stored: ['uno', 'viejo', 'tres'],
        phrases: ['dos', 'uno', 'cuatro'],
      }),
    ).toMatchObject({ added: ['dos', 'cuatro'], dropped: ['viejo', 'tres'] });
  });

  it('reports the phrases as given', () => {
    expect(plan({ phrases: ['dos', 'uno'] }).phrases).toEqual(['dos', 'uno']);
  });

  it('counts a phrase the app does not actively track in a market as a new phrase there', () => {
    expect(plan({ phrases: ['habit'] }).markets[0].newPhrases).toEqual([
      'habit',
    ]);
  });

  it('leaves out a phrase the app already tracks in the market', () => {
    const result = plan({
      phrases: ['habit', 'streak'],
      tracking: lookup({
        [pairKey('us', 'habit')]: { own: 'active', elsewhere: false },
      }),
    });

    expect(result.markets[0]).toMatchObject({
      newPhrases: ['streak'],
      keywordMarkets: 1,
    });
  });

  it('counts a paused phrase as new, because saving resumes it', () => {
    const result = plan({
      phrases: ['habit'],
      tracking: lookup({
        [pairKey('us', 'habit')]: { own: 'paused', elsewhere: true },
      }),
    });

    expect(result.markets[0]).toMatchObject({
      newPhrases: ['habit'],
      keywordMarkets: 0,
    });
  });

  it('does not count a phrase another app tracks as opening a keyword market', () => {
    const result = plan({
      phrases: ['habit', 'streak'],
      tracking: lookup({
        [pairKey('us', 'streak')]: { own: null, elsewhere: true },
      }),
    });

    expect(result.markets[0]).toMatchObject({
      country: 'us',
      newPhrases: ['habit', 'streak'],
      keywordMarkets: 1,
      dailyRequests: 1,
    });
  });

  it('counts a paused phrase no other app tracks as opening a keyword market', () => {
    const result = plan({
      phrases: ['habit'],
      tracking: lookup({
        [pairKey('us', 'habit')]: { own: 'paused', elsewhere: false },
      }),
    });

    expect(result.markets[0].keywordMarkets).toBe(1);
  });

  it('prices the daily requests at the keyword markets times the requests per keyword', () => {
    const result = plan({ phrases: ['a', 'b', 'c'], requestsPerKeyword: 8 });

    expect(result.markets[0].dailyRequests).toBe(24);
  });

  it('answers one entry per reading market, in reader order, carrying its role and home flag', () => {
    const result = plan({ phrases: ['habit'], readers: [US, MX] });

    expect(
      result.markets.map(({ country, role, home }) => ({
        country,
        role,
        home,
      })),
    ).toEqual([US, MX]);
  });

  it('keeps markets independent, so a phrase tracked in one is new in the other', () => {
    const result = plan({
      phrases: ['habit'],
      readers: [US, MX],
      tracking: lookup({
        [pairKey('us', 'habit')]: { own: 'active', elsewhere: false },
      }),
    });

    expect(result.markets.map((market) => market.newPhrases)).toEqual([
      [],
      ['habit'],
    ]);
  });

  it('answers no market and no cost when no market reads the localization', () => {
    const result = plan({ stored: ['viejo'], phrases: ['habit'], readers: [] });

    expect(result).toEqual({
      phrases: ['habit'],
      added: ['habit'],
      dropped: ['viejo'],
      markets: [],
    });
  });

  it('drops every stored phrase and adds none for an empty field', () => {
    const result = plan({ stored: ['uno', 'dos'], phrases: [] });

    expect(result).toMatchObject({
      added: [],
      dropped: ['uno', 'dos'],
    });
    expect(result.markets[0]).toMatchObject({
      newPhrases: [],
      keywordMarkets: 0,
      dailyRequests: 0,
    });
  });
});
