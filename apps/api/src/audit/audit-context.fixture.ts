import { Store } from '@prisma/client';
import { KeywordBucket } from '@asobeast/shared';
import { RawAppFacts } from '../store-providers/raw-facts';
import {
  AuditCompetitor,
  AuditContext,
  AuditKeyword,
  AuditReview,
} from './audit-scoring';

export const FIXTURE_NOW = new Date('2026-07-09T00:00:00.000Z');

export const emptyFacts: RawAppFacts = {
  screenshotCount: null,
  ipadScreenshotCount: null,
  genres: [],
  releaseNotes: null,
  languages: [],
  contentRating: null,
  genreKey: null,
  genreName: null,
  videoUrl: null,
  featureGraphicUrl: null,
  supportsIpad: false,
  developerName: null,
  currentVersionScore: null,
  currentVersionReviews: null,
  iconUrl: null,
  screenshotUrls: [],
};

export const competitor = (
  overrides: Partial<AuditCompetitor> = {},
): AuditCompetitor => ({
  id: 'rival',
  name: 'Rival',
  title: 'Rival Quiz',
  subtitle: null,
  ratingAvg: null,
  ratingCount: null,
  screenshotCount: null,
  hasVideo: false,
  iconUrl: null,
  storeUpdatedAt: null,
  ...overrides,
});

export const reviewsFrom = (
  now: Date,
  scores: number[],
  text = 'A review',
): AuditReview[] =>
  scores.map((score) => ({
    score,
    title: null,
    text,
    reviewedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  }));

export const keyword = (
  text: string,
  bucket: KeywordBucket,
  opportunity: number,
  overrides: Partial<AuditKeyword> = {},
): AuditKeyword => ({
  text,
  source: 'MANUAL',
  bucket,
  relevance: 100,
  position: null,
  traffic: null,
  volume: null,
  opportunity,
  ...overrides,
});

export interface ContextOverrides extends Partial<AuditContext> {
  facts?: Partial<RawAppFacts>;
}

const contextFor = (
  store: Store,
  overrides: ContextOverrides = {},
): AuditContext => {
  const { facts, ...rest } = overrides;
  return {
    appId: 'app1',
    store,
    country: 'us',
    title: '',
    subtitle: null,
    summary: null,
    description: '',
    keywordField: null,
    ratingAvg: null,
    ratingCount: null,
    storeUpdatedAt: null,
    now: FIXTURE_NOW,
    rawFacts: { ...emptyFacts, ...facts },
    keywords: [],
    visibility: { latest: null, latestDate: null, weekAgo: null },
    comparison: { competitors: [], rows: [] },
    competitors: [],
    reviews: [],
    reviewScoreMax: 2,
    brandTokens: [],
    aiChecks: {},
    aiStatus: { configured: false, model: null, generatedAt: null },
    ...rest,
  };
};

export const appStoreContext = (overrides: ContextOverrides = {}) =>
  contextFor(Store.APP_STORE, overrides);

export const playContext = (overrides: ContextOverrides = {}) =>
  contextFor(Store.GOOGLE_PLAY, overrides);
