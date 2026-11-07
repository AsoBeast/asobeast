import {
  appDelisted,
  appUnlistedMarket,
  rival,
} from '../listing-events.fixture';
import {
  availabilityFacts,
  availabilityRow,
  availabilitySentence,
  availabilityTone,
} from './report-availability';

describe('availability wording', () => {
  it.each([
    [
      appDelisted(),
      'My App',
      '🇺🇸 US',
      '',
      'My App is no longer listed in the App Store (🇺🇸 US)',
    ],
    [
      appDelisted({ app: rival }),
      'Rival',
      'US',
      '',
      'Rival, a competitor, is no longer listed in the App Store (US)',
    ],
    [
      appDelisted({ store: 'GOOGLE_PLAY' }),
      'My App',
      'US',
      '',
      'My App is no longer listed in Google Play (US)',
    ],
    [
      appUnlistedMarket(),
      'My App',
      'US',
      '🇩🇪 DE',
      'My App is no longer listed in the App Store in 🇩🇪 DE, where 12 keywords are tracked',
    ],
    [
      appUnlistedMarket({ trackedKeywords: 1 }),
      'My App',
      'US',
      'DE',
      'My App is no longer listed in the App Store in DE, where 1 keyword is tracked',
    ],
    [
      appUnlistedMarket({ trackedKeywords: 0 }),
      'My App',
      'US',
      'DE',
      'My App is no longer listed in the App Store in DE',
    ],
    [
      appUnlistedMarket({ app: rival }),
      'Rival',
      'US',
      'DE',
      'Rival, a competitor, is no longer listed in the App Store in DE, where 12 keywords are tracked',
    ],
    [
      appUnlistedMarket({ app: rival, trackedKeywords: 0 }),
      'Rival',
      'US',
      'DE',
      'Rival, a competitor, is no longer listed in the App Store in DE',
    ],
  ])('words %#', (alert, app, home, market, sentence) => {
    expect(availabilitySentence(alert, app, home, market)).toBe(sentence);
  });

  it('lists the facts in order', () => {
    expect(availabilityFacts(appDelisted(), 'US', '')).toEqual([
      { label: 'Type', value: 'Your app' },
      { label: 'Store', value: 'App Store' },
      { label: 'Storefront', value: 'US' },
      { label: 'Day', value: '3 Nov 2026' },
    ]);
    expect(
      availabilityFacts(
        appUnlistedMarket({ app: rival, store: 'GOOGLE_PLAY' }),
        'US',
        'DE',
      ),
    ).toEqual([
      { label: 'Type', value: 'Competitor' },
      { label: 'Store', value: 'Google Play' },
      { label: 'Market', value: 'DE' },
      { label: 'Day', value: '3 Nov 2026' },
      { label: 'Keywords tracked there', value: '12' },
    ]);
  });

  it('builds a row per fact, the keywords only above zero', () => {
    expect(availabilityRow(appDelisted())).toEqual({
      kind: 'text',
      text: 'No longer listed in the App Store',
      detail: null,
    });
    expect(availabilityRow(appUnlistedMarket())).toMatchObject({
      text: 'No longer listed in DE · 12 keywords tracked',
    });
    expect(
      availabilityRow(appUnlistedMarket({ trackedKeywords: 0 })),
    ).toMatchObject({ text: 'No longer listed in DE' });
    expect(availabilityRow(appUnlistedMarket({ app: rival }))).toMatchObject({
      text: 'No longer listed in DE · 12 keywords tracked',
    });
  });

  it('tones an own app down and a competitor neutral', () => {
    expect(availabilityTone(appDelisted())).toBe('down');
    expect(availabilityTone(appDelisted({ app: rival }))).toBe('neutral');
  });
});
