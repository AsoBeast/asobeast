import { Store } from '@prisma/client';
import {
  AppStoreLocalization,
  COVERAGE_PREVIEW_CHANGES,
  CoveragePreviewChange,
  CoveragePreviewKeyword,
  CoverageVerdict,
  KEYWORD_BUCKETS,
  KeywordBucket,
  KeywordClass,
  keywordFieldLocalizations,
  parseKeywordField,
} from '@asobeast/shared';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import { readsKeywordField } from '../keywords/localization-markets';
import {
  CoverageSources,
  judgeKeywordCoverage,
  KeywordCoverage,
} from './keyword-coverage-judge';

export interface ListingDraftTexts {
  title?: string;
  subtitle?: string;
  shortDescription?: string;
  keywordField?: string;
  description?: string;
}

export type DraftTarget =
  | { store: typeof Store.APP_STORE; localization: AppStoreLocalization }
  | { store: typeof Store.GOOGLE_PLAY; country: string };

export interface PreviewableKeyword {
  keywordId: string;
  text: string;
  country: string;
  bucket: KeywordBucket | null;
  keywordClass?: KeywordClass;
}

interface DraftApp {
  store: Store;
  country: string;
}

const EMPTY_TEXTS: ListingTexts = {
  id: '',
  title: '',
  subtitle: null,
  summary: null,
  description: '',
};

const resolvedCountry = (
  app: DraftApp,
  sources: CoverageSources,
  market: string,
): string => (sources.listings.has(market) ? market : app.country);

const mergeTexts = (
  base: ListingTexts,
  draft: ListingDraftTexts,
): ListingTexts => ({
  ...base,
  title: draft.title ?? base.title,
  subtitle: draft.subtitle ?? base.subtitle,
  summary: draft.shortDescription ?? draft.subtitle ?? base.summary,
  description: draft.description ?? base.description,
});

const withLocalization = (
  captured: readonly LocalizedTexts[],
  localization: AppStoreLocalization,
  draft: ListingDraftTexts,
): LocalizedTexts[] => {
  const own = captured.find((entry) => entry.localization === localization);
  const drafted = {
    localization,
    texts: mergeTexts(own?.texts ?? EMPTY_TEXTS, draft),
  };
  return own
    ? captured.map((entry) => (entry === own ? drafted : entry))
    : [...captured, drafted];
};

function withAppStoreDraft(
  sources: CoverageSources,
  localization: AppStoreLocalization,
  draft: ListingDraftTexts,
): CoverageSources {
  const listings = new Map(sources.listings);
  const localized = new Map(sources.localized);
  const keywordFields = new Map(sources.keywordFields);
  for (const [country, listing] of sources.listings) {
    const read = keywordFieldLocalizations(country);
    if (read[0] === localization) {
      listings.set(country, mergeTexts(listing, draft));
    } else if (read.includes(localization)) {
      localized.set(
        country,
        withLocalization(
          sources.localized.get(country) ?? [],
          localization,
          draft,
        ),
      );
    }
  }
  if (draft.keywordField !== undefined) {
    keywordFields.set(
      localization,
      parseKeywordField(draft.keywordField).phrases,
    );
  }
  return { listings, localized, keywordFields };
}

export function withDraft(
  sources: CoverageSources,
  app: DraftApp,
  target: DraftTarget,
  draft: ListingDraftTexts,
): CoverageSources {
  if (target.store === Store.APP_STORE) {
    return withAppStoreDraft(sources, target.localization, draft);
  }
  const country = resolvedCountry(app, sources, target.country);
  const listing = sources.listings.get(country);
  if (!listing) return sources;
  const listings = new Map(sources.listings);
  listings.set(country, mergeTexts(listing, draft));
  return { ...sources, listings };
}

export function draftMarkets(
  app: DraftApp,
  markets: readonly string[],
  sources: CoverageSources,
  target: DraftTarget,
): { judged: string[]; waiting: string[] } {
  const judged: string[] = [];
  const waiting: string[] = [];
  const drafted =
    target.store === Store.GOOGLE_PLAY
      ? resolvedCountry(app, sources, target.country)
      : null;
  for (const market of markets) {
    const listingCountry = resolvedCountry(app, sources, market);
    if (target.store === Store.GOOGLE_PLAY) {
      if (listingCountry === drafted) judged.push(market);
    } else if (
      keywordFieldLocalizations(listingCountry).includes(target.localization)
    ) {
      judged.push(market);
    } else if (readsKeywordField(market, target.localization)) {
      waiting.push(market);
    }
  }
  return { judged, waiting };
}

const verdictOf = (coverage: KeywordCoverage): CoverageVerdict => ({
  fields: coverage.fields,
  covered: !coverage.uncovered,
  wordsSplit: coverage.wordsSplit,
});

const changeOf = (
  live: CoverageVerdict,
  draft: CoverageVerdict,
): CoveragePreviewChange => {
  if (live.covered) return draft.covered ? 'kept' : 'lost';
  return draft.covered ? 'gained' : 'missing';
};

const bucketRank = (bucket: KeywordBucket | null): number =>
  bucket === null ? KEYWORD_BUCKETS.length : KEYWORD_BUCKETS.indexOf(bucket);

const readingOrder = (
  a: CoveragePreviewKeyword,
  b: CoveragePreviewKeyword,
): number =>
  COVERAGE_PREVIEW_CHANGES.indexOf(a.change) -
    COVERAGE_PREVIEW_CHANGES.indexOf(b.change) ||
  bucketRank(a.bucket) - bucketRank(b.bucket) ||
  a.text.localeCompare(b.text);

export function previewKeywords(
  app: DraftApp,
  keywords: readonly PreviewableKeyword[],
  live: CoverageSources,
  draft: CoverageSources,
): CoveragePreviewKeyword[] {
  return keywords
    .map((keyword) => {
      const liveVerdict = verdictOf(judgeKeywordCoverage(app, keyword, live));
      const draftVerdict = verdictOf(judgeKeywordCoverage(app, keyword, draft));
      return {
        keywordId: keyword.keywordId,
        text: keyword.text,
        country: keyword.country,
        bucket: keyword.bucket,
        ...(keyword.keywordClass ? { keywordClass: keyword.keywordClass } : {}),
        live: liveVerdict,
        draft: draftVerdict,
        change: changeOf(liveVerdict, draftVerdict),
      };
    })
    .sort(readingOrder);
}

export const changeCounts = (
  keywords: readonly Pick<CoveragePreviewKeyword, 'change'>[],
): Record<CoveragePreviewChange, number> => {
  const counts: Record<CoveragePreviewChange, number> = {
    lost: 0,
    gained: 0,
    missing: 0,
    kept: 0,
  };
  for (const { change } of keywords) counts[change] += 1;
  return counts;
};

export function draftedListing(
  app: DraftApp,
  drafted: CoverageSources,
  target: DraftTarget,
  market: string | undefined,
): ListingTexts | undefined {
  if (market === undefined) return undefined;
  const country = resolvedCountry(app, drafted, market);
  if (
    target.store === Store.GOOGLE_PLAY ||
    keywordFieldLocalizations(country)[0] === target.localization
  ) {
    return drafted.listings.get(country);
  }
  return drafted.localized
    .get(country)
    ?.find((entry) => entry.localization === target.localization)?.texts;
}

export const draftOverEmptyListing = (draft: ListingDraftTexts): ListingTexts =>
  mergeTexts(EMPTY_TEXTS, draft);
