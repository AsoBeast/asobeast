import {
  appStoreContext,
  FIXTURE_NOW,
  playContext,
} from '../audit-context.fixture';
import { DAY_MS } from '../audit-scoring';
import { conversionChecks } from './conversion-checks';

const checkOf = (checks: ReturnType<typeof conversionChecks>, id: string) =>
  checks.find((item) => item.id === id);

describe('conversionChecks', () => {
  it.each([
    [30, 10],
    [31, 8],
    [60, 8],
    [61, 6],
    [90, 6],
    [91, 3],
    [180, 3],
    [181, 0],
  ])('scores an update %i days ago as %i', (days, score) => {
    const storeUpdatedAt = new Date(FIXTURE_NOW.getTime() - days * DAY_MS);

    expect(
      checkOf(
        conversionChecks(appStoreContext({ storeUpdatedAt })),
        'conversion-update-recency',
      )?.score,
    ).toBe(score);
  });

  it('omits the recency check without an update date', () => {
    expect(
      checkOf(conversionChecks(appStoreContext()), 'conversion-update-recency'),
    ).toBeUndefined();
  });

  it.each([
    [null, 0],
    ['Bug fixes and improvements.', 5],
    ['x'.repeat(39), 5],
    ['Adds a world map mode with 40 new cities.', 10],
  ])('scores release notes %s as %i', (releaseNotes, score) => {
    expect(
      checkOf(
        conversionChecks(appStoreContext({ facts: { releaseNotes } })),
        'conversion-release-notes',
      )?.score,
    ).toBe(score);
  });

  it.each([
    [[], null],
    [['EN'], 4],
    [['EN', 'PL'], 6],
    [['EN', 'PL', 'DE', 'FR'], 6],
    [['EN', 'PL', 'DE', 'FR', 'ES'], 8],
    [['EN', 'PL', 'DE', 'FR', 'ES', 'IT', 'PT', 'JA', 'KO', 'ZH'], 10],
  ])('scores languages %j as %s', (languages, score) => {
    expect(
      checkOf(
        conversionChecks(appStoreContext({ facts: { languages } })),
        'conversion-localizations',
      )?.score ?? null,
    ).toBe(score);
  });

  it('checks a privacy policy on Google Play only', () => {
    expect(conversionChecks(playContext()).map((item) => item.id)).toContain(
      'conversion-privacy-policy',
    );
    expect(
      conversionChecks(appStoreContext()).map((item) => item.id),
    ).not.toContain('conversion-privacy-policy');
  });

  it('omits the localizations check on Google Play, which lists no languages', () => {
    expect(
      conversionChecks(playContext()).map((item) => item.id),
    ).not.toContain('conversion-localizations');
  });
});
