import { limitationsFor } from './audit-limitations';

describe('limitationsFor', () => {
  it('lists what the App Store audit cannot see, in order', () => {
    expect(limitationsFor('APP_STORE').map((item) => item.id)).toEqual([
      'promotional-text',
      'in-app-events',
      'accessibility-features',
      'custom-product-pages',
      'review-replies',
      'rating-prompts',
      'conversion-rate',
    ]);
  });

  it('leaves the in-app events limitation to the page and the console', () => {
    const events = limitationsFor('APP_STORE').find(
      (item) => item.id === 'in-app-events',
    );

    expect(events?.label).toBe('Past in-app events and their performance');
    expect(events?.detail).toBe(
      'The page shows the events that are live or upcoming; events that have ended and how each event performed are App Store Connect only.',
    );
  });

  it('lists what the Google Play audit cannot see, in order', () => {
    expect(limitationsFor('GOOGLE_PLAY').map((item) => item.id)).toEqual([
      'video-content',
      'promotional-content',
      'custom-store-listings',
      'store-listing-experiments',
      'android-vitals',
      'rating-prompts',
      'conversion-rate',
    ]);
  });

  it('gives every limitation a label and a detail', () => {
    for (const store of ['APP_STORE', 'GOOGLE_PLAY'] as const) {
      for (const limitation of limitationsFor(store)) {
        expect(limitation.label.length).toBeGreaterThan(0);
        expect(limitation.detail.length).toBeGreaterThan(0);
      }
    }
  });
});
