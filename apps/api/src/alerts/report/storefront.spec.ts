import type { ReportApp } from './report';
import {
  identityLine,
  storeName,
  storefrontFlag,
  storefrontLabel,
} from './storefront';

const app = (overrides: Partial<ReportApp> = {}): ReportApp => ({
  id: 'a',
  identity: {
    name: 'Alpha',
    iconUrl: null,
    store: 'APP_STORE',
    country: 'us',
    role: 'primary',
  },
  link: null,
  groups: [],
  competitors: [],
  omittedCompetitors: 0,
  competitorsLink: null,
  ...overrides,
});

describe('storefrontFlag', () => {
  it('spells a country code in regional indicators', () => {
    expect(storefrontFlag('us')).toBe('🇺🇸');
    expect(storefrontFlag('uk')).toBe('🇺🇰');
  });

  it('draws no flag for a code that is not two letters', () => {
    expect(storefrontFlag('zz1')).toBeNull();
    expect(storefrontFlag('')).toBeNull();
  });
});

describe('storefrontLabel', () => {
  it('prints the code with or without its flag', () => {
    expect(storefrontLabel('pl', true)).toBe('🇵🇱 PL');
    expect(storefrontLabel('pl', false)).toBe('PL');
  });

  it('prints nothing for an unknown storefront', () => {
    expect(storefrontLabel(null, true)).toBe('');
  });
});

describe('storeName', () => {
  it('names both stores', () => {
    expect(storeName('APP_STORE')).toBe('App Store');
    expect(storeName('GOOGLE_PLAY')).toBe('Google Play');
  });
});

describe('identityLine', () => {
  it('names the store and storefront of an app in its own report', () => {
    expect(identityLine(app(), true)).toBe('App Store · 🇺🇸 US');
    expect(identityLine(app(), false)).toBe('App Store · US');
  });

  it('calls the app yours when it heads its competitors', () => {
    expect(identityLine(app({ competitors: [app()] }), false)).toBe(
      'Your app · App Store · US',
    );
  });

  it('names a competitor as one', () => {
    const rival = app();
    rival.identity = { ...rival.identity, role: 'competitor' };

    expect(identityLine(rival, true)).toBe('Competitor · App Store · 🇺🇸 US');
  });

  it('leaves out what an older payload does not carry', () => {
    const legacy = app();
    legacy.identity = { ...legacy.identity, store: null, country: null };

    expect(identityLine(legacy, true)).toBe('');
  });
});
