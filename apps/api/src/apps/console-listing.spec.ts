import { descriptionFingerprint } from './description-fingerprint';
import { consoleListingOf, staleConsoleListing } from './console-listing';

const A = 'Plan the family week.';
const B = 'Organise the family week.';

const row = (
  overrides: Partial<Parameters<typeof consoleListingOf>[0]> = {},
) => ({
  version: '1.9',
  primaryLocale: 'en-US',
  descriptionFingerprints: { 'en-US': descriptionFingerprint(A) },
  ...overrides,
});

describe('consoleListingOf', () => {
  it('reads the stored version, primary and fingerprints', () => {
    expect(consoleListingOf(row())).toEqual({
      version: '1.9',
      primary: 'en-US',
      fingerprints: new Map([['en-US', descriptionFingerprint(A)]]),
    });
  });

  it('answers null without a row or without fingerprints', () => {
    expect(consoleListingOf(null)).toBeNull();
    expect(consoleListingOf(row({ descriptionFingerprints: null }))).toBeNull();
  });

  it.each([
    ['a list', ['en-US']],
    ['a string', 'en-US'],
    ['a number', 7],
  ])('answers null for fingerprints stored as %s', (_case, value) => {
    expect(
      consoleListingOf(row({ descriptionFingerprints: value })),
    ).toBeNull();
  });

  it('keeps only app store tags with a string fingerprint and a known primary', () => {
    expect(
      consoleListingOf(
        row({
          primaryLocale: 'xx-YY',
          descriptionFingerprints: {
            'en-US': descriptionFingerprint(A),
            'xx-YY': descriptionFingerprint(B),
            de: 42,
          },
        }),
      ),
    ).toEqual({
      version: '1.9',
      primary: null,
      fingerprints: new Map([['en-US', descriptionFingerprint(A)]]),
    });
  });
});

describe('staleConsoleListing', () => {
  const listing = consoleListingOf(row());

  it('is stale when no fingerprint matches and the versions differ', () => {
    expect(staleConsoleListing(listing, B, '2.0')).toBe(true);
  });

  it('is not stale when a fingerprint matches', () => {
    expect(staleConsoleListing(listing, A, '2.0')).toBe(false);
  });

  it('is not stale on the same version', () => {
    expect(staleConsoleListing(listing, B, '1.9')).toBe(false);
  });

  it('is never stale without a known version on either side', () => {
    expect(staleConsoleListing(listing, B, null)).toBe(false);
    expect(
      staleConsoleListing(consoleListingOf(row({ version: null })), B, '2.0'),
    ).toBe(false);
  });

  it('is never stale without a listing', () => {
    expect(staleConsoleListing(null, B, '2.0')).toBe(false);
  });
});
