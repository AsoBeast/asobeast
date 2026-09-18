import { Store } from '@prisma/client';
import { KeywordBucket } from '@asobeast/shared';
import { RawAppFacts } from '../store-providers/raw-facts';
import {
  AuditCompetitor,
  AuditContext,
  AuditCreativeState,
  AuditKeyword,
  AuditReview,
} from './audit-scoring';
import {
  analyzedMedia,
  CreativeObservations,
  ScreenshotObservation,
} from './creative/creative-observations';

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
  privacyPolicyUrl: null,
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
    repliedAt: null,
    replyCheckedAt: null,
  }));

export const keyword = (
  text: string,
  bucket: KeywordBucket,
  opportunity: number,
  overrides: Partial<AuditKeyword> = {},
): AuditKeyword => ({
  id: text,
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

const emptyCreative = (
  store: Store,
  facts: Partial<RawAppFacts> = {},
): AuditCreativeState => ({
  observations: null,
  inputs: {
    store,
    country: 'us',
    title: '',
    iconUrl: facts.iconUrl ?? null,
    screenshotUrls: facts.screenshotUrls ?? [],
    competitorIcons: [],
  },
  media: null,
  analyzedAt: null,
  model: null,
  stale: false,
});

export const screenshotObservation = (
  position: number,
  overrides: Partial<ScreenshotObservation> = {},
): ScreenshotObservation => ({
  position,
  captionText: `Caption ${position}`,
  captionReadable: true,
  captionLanguage: 'en',
  message: 'benefit',
  ...overrides,
});

export const observations = (
  overrides: Partial<CreativeObservations> = {},
): CreativeObservations => ({
  icon: {
    hasText: false,
    elementCount: 'one',
    contrast: 'high',
    similarCompetitorPosition: null,
  },
  screenshots: [1, 2, 3].map((position) => screenshotObservation(position)),
  consistentStyle: true,
  ...overrides,
});

export const analyzedCreative = (
  store: Store,
  overrides: Partial<AuditCreativeState> = {},
): AuditCreativeState => {
  const empty = emptyCreative(store);
  return {
    ...empty,
    observations: observations(),
    media: analyzedMedia(overrides.inputs ?? empty.inputs),
    analyzedAt: FIXTURE_NOW,
    model: 'gpt-5.6-luna',
    ...overrides,
  };
};

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
    creative: emptyCreative(store, facts),
    aiStatus: { configured: false, model: null, generatedAt: null },
    run: null,
    ...rest,
  };
};

export const appStoreContext = (overrides: ContextOverrides = {}) =>
  contextFor(Store.APP_STORE, overrides);

export const playContext = (overrides: ContextOverrides = {}) =>
  contextFor(Store.GOOGLE_PLAY, overrides);

export const daysAgo = (days: number): Date =>
  new Date(FIXTURE_NOW.getTime() - days * 24 * 60 * 60 * 1000);

const poorKeywords = (): AuditKeyword[] => [
  keyword('geo quiz', 'primary', 90, { id: 'k1', position: null, traffic: 9 }),
  keyword('geography game', 'primary', 70, {
    id: 'k2',
    position: 40,
    traffic: 5,
  }),
  keyword('world map', 'secondary', 50, { id: 'k3', position: 80, traffic: 3 }),
];

const poorCompetitors = (): AuditCompetitor[] => [
  competitor({
    id: 'a',
    name: 'Atlas Labs',
    title: 'Atlas Geo Quiz',
    ratingCount: 9000,
    ratingAvg: 4.7,
    screenshotCount: 10,
    hasVideo: true,
    storeUpdatedAt: daysAgo(5),
  }),
  competitor({
    id: 'b',
    name: 'Mapster',
    title: 'Mapster World Map',
    ratingCount: 4000,
    ratingAvg: 4.4,
    screenshotCount: 8,
    hasVideo: false,
    storeUpdatedAt: daysAgo(20),
  }),
];

const poorReviews = (): AuditReview[] =>
  reviewsFrom(FIXTURE_NOW, [1, 1, 2, 2, 3, 3], 'The ads are everywhere');

const poorShared = () => ({
  title: 'Quiz App',
  description: '',
  ratingAvg: 3.2,
  ratingCount: 50,
  storeUpdatedAt: daysAgo(200),
  keywords: poorKeywords(),
  competitors: poorCompetitors(),
  reviews: poorReviews(),
  visibility: {
    latest: 4,
    latestDate: '2026-07-09',
    weekAgo: 18,
  },
  comparison: {
    competitors: [{ id: 'a', name: 'Atlas Labs' }],
    rows: [
      {
        keywordId: 'k1',
        text: 'geo quiz',
        traffic: 9,
        difficulty: 5,
        you: null,
        positions: { a: 3 },
        gap: true,
      },
      {
        keywordId: 'k2',
        text: 'geography game',
        traffic: 5,
        difficulty: 4,
        you: 40,
        positions: { a: 6 },
        gap: true,
      },
    ],
  },
});

export const poorAppStoreContext = (): AuditContext =>
  appStoreContext({
    ...poorShared(),
    subtitle: '',
    keywordField: 'app,free',
    facts: {
      screenshotCount: 2,
      screenshotUrls: ['s0.png', 's1.png'],
      languages: ['EN'],
      supportsIpad: true,
      ipadScreenshotCount: 0,
      currentVersionScore: 2.6,
      currentVersionReviews: 40,
    },
  });

export const poorPlayContext = (): AuditContext =>
  playContext({
    ...poorShared(),
    summary: 'Best quiz, download now',
    facts: {
      screenshotCount: 2,
      screenshotUrls: ['s0.png', 's1.png'],
    },
  });
