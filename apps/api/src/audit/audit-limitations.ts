import { Store } from '@prisma/client';
import { AuditLimitation } from '@asobeast/shared';

const APP_STORE_LIMITATIONS: readonly AuditLimitation[] = [
  {
    id: 'preview-video',
    label: 'App previews',
    detail:
      'asobeast cannot see App Store previews. Up to 3 per localization, up to 30 seconds, autoplaying muted in search. Check them in App Store Connect.',
  },
  {
    id: 'promotional-text',
    label: 'Promotional text',
    detail:
      'Not in the data asobeast reads. 170 characters above the description, editable without a release, not indexed.',
  },
  {
    id: 'in-app-events',
    label: 'In-app events',
    detail:
      'Not visible to asobeast. Events can appear in search results and on the Today tab.',
  },
  {
    id: 'custom-product-pages',
    label: 'Custom product pages',
    detail:
      'Not visible to asobeast. Up to 70, and a page with assigned keywords appears in organic search for them.',
  },
  {
    id: 'review-replies',
    label: 'Replies to reviews',
    detail:
      'The App Store review feed asobeast reads carries no developer replies.',
  },
  {
    id: 'rating-prompts',
    label: 'Rating prompts',
    detail:
      'Happen inside your app: ask after a success moment, at most three times a year.',
  },
  {
    id: 'conversion-rate',
    label: 'Product page conversion',
    detail: 'App Store Connect analytics only.',
  },
];

const GOOGLE_PLAY_LIMITATIONS: readonly AuditLimitation[] = [
  {
    id: 'video-content',
    label: 'Promo video content',
    detail: 'asobeast sees whether a video is linked, not what it shows.',
  },
  {
    id: 'promotional-content',
    label: 'Promotional content',
    detail:
      'Offers and events published from Play Console are not visible to asobeast.',
  },
  {
    id: 'custom-store-listings',
    label: 'Custom store listings',
    detail:
      'Not visible to asobeast. Up to 50 variants by country, audience or campaign.',
  },
  {
    id: 'store-listing-experiments',
    label: 'Store listing experiments',
    detail: 'Run and read in Play Console.',
  },
  {
    id: 'android-vitals',
    label: 'Android vitals',
    detail:
      'A user perceived crash rate above 1.09% or ANR rate above 0.47% reduces visibility. Play Console only.',
  },
  {
    id: 'rating-prompts',
    label: 'Rating prompts',
    detail: 'Happen inside your app through the In-App Review API.',
  },
  {
    id: 'conversion-rate',
    label: 'Store listing conversion',
    detail: 'Play Console only.',
  },
];

export const AUDIT_LIMITATIONS: Record<Store, readonly AuditLimitation[]> = {
  APP_STORE: APP_STORE_LIMITATIONS,
  GOOGLE_PLAY: GOOGLE_PLAY_LIMITATIONS,
};

export const limitationsFor = (store: Store): readonly AuditLimitation[] =>
  AUDIT_LIMITATIONS[store];
