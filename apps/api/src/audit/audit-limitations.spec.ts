import { limitationsFor } from './audit-limitations';

describe('limitationsFor', () => {
  it('lists what the App Store audit cannot see, in order', () => {
    expect(limitationsFor('APP_STORE').map((item) => item.id)).toEqual([
      'preview-video',
      'promotional-text',
      'in-app-events',
      'custom-product-pages',
      'review-replies',
      'rating-prompts',
      'conversion-rate',
    ]);
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
