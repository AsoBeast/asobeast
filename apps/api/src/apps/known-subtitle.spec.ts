import { Store } from '@prisma/client';
import { NormalizedApp } from '../store-providers/types';
import { withKnownSubtitle } from './known-subtitle';

const read = (overrides: Partial<NormalizedApp>): NormalizedApp => ({
  store: Store.APP_STORE,
  storeAppId: '1',
  title: 'App',
  description: 'desc',
  raw: {},
  searchable: true,
  ...overrides,
});

describe('withKnownSubtitle', () => {
  it('keeps the previous subtitle when the page could not be read', () => {
    const result = withKnownSubtitle(
      read({ subtitle: undefined, subtitleUnavailable: true }),
      'AI assistant for life and work',
    );

    expect(result.subtitle).toBe('AI assistant for life and work');
  });

  it('trusts a page that was read, even when it has no subtitle', () => {
    const result = withKnownSubtitle(
      read({ subtitle: undefined, subtitleUnavailable: false }),
      'AI assistant for life and work',
    );

    expect(result.subtitle).toBeUndefined();
  });

  it('trusts a new subtitle over the previous one', () => {
    const result = withKnownSubtitle(
      read({ subtitle: 'New line', subtitleUnavailable: false }),
      'Old line',
    );

    expect(result.subtitle).toBe('New line');
  });

  it('has nothing to keep when no subtitle was known', () => {
    const normalized = read({ subtitle: undefined, subtitleUnavailable: true });

    expect(withKnownSubtitle(normalized, null)).toBe(normalized);
  });

  it('leaves a Google Play result alone', () => {
    const normalized = read({ store: Store.GOOGLE_PLAY, summary: 'Short' });

    expect(withKnownSubtitle(normalized, null)).toBe(normalized);
  });
});
