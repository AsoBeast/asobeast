import { RatingCounts, RATING_STARS } from '@asobeast/shared';
import { Store } from '@prisma/client';

export interface RawAppFacts {
  screenshotCount: number | null;
  ipadScreenshotCount: number | null;
  genres: string[];
  releaseNotes: string | null;
  languages: string[];
  contentRating: string | null;
  genreKey: string | null;
  genreName: string | null;
  hasVideo: boolean | null;
  iconUrl: string | null;
  screenshotUrls: string[];
}

const EMPTY_FACTS: RawAppFacts = {
  screenshotCount: null,
  ipadScreenshotCount: null,
  genres: [],
  releaseNotes: null,
  languages: [],
  contentRating: null,
  genreKey: null,
  genreName: null,
  hasVideo: null,
  iconUrl: null,
  screenshotUrls: [],
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;

const arrayLength = (value: unknown): number | null =>
  Array.isArray(value) ? value.length : null;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const trimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const numeric = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = trimmedString(value);
  if (text === null) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const countOf = (value: unknown): number | null => {
  const parsed = numeric(value);
  return parsed !== null && parsed >= 0 && Number.isInteger(parsed)
    ? parsed
    : null;
};

const categoryNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => asRecord(entry)?.name)
        .filter((name): name is string => typeof name === 'string')
    : [];

export function screenshotsCount(raw: unknown): number | null {
  return arrayLength(asRecord(raw)?.screenshots);
}

export function primaryGenreId(raw: unknown): number | null {
  const value = asRecord(raw)?.primaryGenreId;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function primaryGenreKey(store: Store, raw: unknown): string | null {
  if (store === Store.GOOGLE_PLAY) {
    return nonEmptyString(asRecord(raw)?.genreId);
  }
  const id = primaryGenreId(raw);
  return id === null ? null : String(id);
}

export function primaryGenreName(store: Store, raw: unknown): string | null {
  if (store === Store.GOOGLE_PLAY) {
    return nonEmptyString(asRecord(raw)?.genre);
  }
  return nonEmptyString(asRecord(raw)?.primaryGenre);
}

export function developerId(store: Store, raw: unknown): string | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  if (store === Store.GOOGLE_PLAY) {
    return nonEmptyString(record.developerId);
  }
  const id = numeric(record.artistId ?? record.developerId);
  return id === null ? null : String(id);
}

export function ratingHistogram(
  store: Store,
  raw: unknown,
): RatingCounts | null {
  if (store !== Store.GOOGLE_PLAY) {
    return null;
  }
  const histogram = asRecord(asRecord(raw)?.histogram);
  if (!histogram) {
    return null;
  }
  const counts = {} as RatingCounts;
  for (const star of RATING_STARS) {
    const value = countOf(histogram[star]);
    if (value === null) {
      return null;
    }
    counts[star] = value;
  }
  return counts;
}

export function isPaid(raw: unknown): boolean {
  const value = asRecord(raw)?.price;
  return typeof value === 'number' && value > 0;
}

export function releaseNotesFor(store: Store, raw: unknown): string | null {
  const key = store === Store.GOOGLE_PLAY ? 'recentChanges' : 'releaseNotes';
  return trimmedString(asRecord(raw)?.[key]);
}

export function extractAppStoreRawFacts(raw: unknown): RawAppFacts {
  const record = asRecord(raw);
  if (!record) {
    return { ...EMPTY_FACTS };
  }
  return {
    screenshotCount: arrayLength(record.screenshots),
    ipadScreenshotCount: arrayLength(record.ipadScreenshots),
    genres: stringArray(record.genres),
    releaseNotes: nonEmptyString(record.releaseNotes),
    languages: stringArray(record.languages),
    contentRating: nonEmptyString(record.contentRating),
    genreKey: primaryGenreKey(Store.APP_STORE, record),
    genreName: nonEmptyString(record.primaryGenre),
    hasVideo: null,
    iconUrl: nonEmptyString(record.icon),
    screenshotUrls: stringArray(record.screenshots),
  };
}

export function extractGooglePlayRawFacts(raw: unknown): RawAppFacts {
  const record = asRecord(raw);
  if (!record) {
    return { ...EMPTY_FACTS };
  }
  return {
    screenshotCount: arrayLength(record.screenshots),
    ipadScreenshotCount: null,
    genres: categoryNames(record.categories),
    releaseNotes: nonEmptyString(record.recentChanges),
    languages: [],
    contentRating: nonEmptyString(record.contentRating),
    genreKey: nonEmptyString(record.genreId),
    genreName: nonEmptyString(record.genre),
    hasVideo: Boolean(record.video),
    iconUrl: nonEmptyString(record.icon),
    screenshotUrls: stringArray(record.screenshots),
  };
}

export function extractRawFacts(store: Store, raw: unknown): RawAppFacts {
  return store === Store.GOOGLE_PLAY
    ? extractGooglePlayRawFacts(raw)
    : extractAppStoreRawFacts(raw);
}
