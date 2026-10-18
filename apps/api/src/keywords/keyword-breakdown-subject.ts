import { Store } from '@prisma/client';
import {
  type KeywordBreakdownApp,
  type KeywordBreakdownField,
  type KeywordBreakdownListing,
  type KeywordBreakdownRating,
  keywordFieldLocalizations,
  readLocalizations,
} from '@asobeast/shared';
import type { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import { capturedLocalizations } from '../apps/market-localizations';
import {
  type FieldPhrases,
  judgingSurfaces,
} from '../metadata/listing-surfaces';
import type { Surface } from '../metadata/localized-coverage';
import {
  bestPlacement,
  judgeField,
  judgeListing,
} from './keyword-breakdown-fields';

export interface BreakdownListing {
  texts: ListingTexts;
  country: string;
  capturedAt: Date;
  ratingAvg: number | null;
  ratingCount: number | null;
}

export interface BreakdownSubject {
  id: string;
  name: string | null;
  iconUrl: string | null;
  isYou: boolean;
  listing: BreakdownListing | null;
  localized: readonly LocalizedTexts[];
  fields: FieldPhrases;
  shipped: readonly string[];
  ranking: { position: number | null; depth: number; date: Date } | null;
}

export interface BreakdownContext {
  store: Store;
  market: string;
  home: string;
  keyword: string;
  words: readonly string[];
}

const LISTING_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'subtitle',
  'shortDescription',
  'description',
]);

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function judged(
  surfaces: readonly Surface[],
  { keyword, words }: BreakdownContext,
): KeywordBreakdownField[] {
  return surfaces.map((surface) =>
    judgeField(
      surface.field === 'keywordField'
        ? { ...surface, value: surface.value.replaceAll(',', ', ') }
        : surface,
      keyword,
      words,
      surface.field !== 'description',
    ),
  );
}

function listingsOf(
  subject: BreakdownSubject,
  context: BreakdownContext,
): KeywordBreakdownListing[] {
  const { store, market, home } = context;
  const appStore = store === Store.APP_STORE;
  const { surfaces, localized } = judgingSurfaces(
    {
      store,
      country: market,
      home: subject.isYou && market === home,
      listing: subject.listing?.texts,
      captured: subject.localized,
    },
    subject.fields,
  );
  const own = subject.listing
    ? surfaces
    : surfaces.filter((surface) => !LISTING_FIELDS.has(surface.field));
  const defaults =
    own.length === 0
      ? []
      : [
          judgeListing(
            appStore ? keywordFieldLocalizations(market)[0] : null,
            appStore ? 'default' : null,
            judged(own, context),
          ),
        ];
  return [
    ...defaults,
    ...localized.map((entry) =>
      judgeListing(
        entry.localization,
        'additional',
        judged(entry.surfaces, context),
      ),
    ),
  ];
}

function unreadOf(
  subject: BreakdownSubject,
  { store, market }: BreakdownContext,
): string[] {
  if (store !== Store.APP_STORE) return [];
  const captured = new Set(
    subject.localized.map((entry) => entry.localization),
  );
  const searched = subject.isYou
    ? capturedLocalizations(market, subject.shipped)
    : readLocalizations(market).slice(1);
  return searched.filter((localization) => !captured.has(localization));
}

function ratingOf(
  listing: BreakdownListing | null,
): KeywordBreakdownRating | null {
  if (
    !listing ||
    (listing.ratingAvg === null && listing.ratingCount === null)
  ) {
    return null;
  }
  return {
    average: listing.ratingAvg,
    count: listing.ratingCount,
    country: listing.country,
  };
}

export function breakdownApp(
  subject: BreakdownSubject,
  context: BreakdownContext,
): KeywordBreakdownApp {
  const listings = listingsOf(subject, context);
  const { ranking, listing } = subject;
  return {
    appId: subject.id,
    name: subject.name,
    iconUrl: subject.iconUrl,
    isYou: subject.isYou,
    ranking: ranking && { ...ranking, date: isoDay(ranking.date) },
    listingCountry: listing?.country ?? null,
    capturedAt: listing?.capturedAt.toISOString() ?? null,
    listings,
    unread: unreadOf(subject, context),
    placement: bestPlacement(listings),
    rating: ratingOf(listing),
    insight: null,
  };
}

const rankGroup = (app: KeywordBreakdownApp): number => {
  if (app.ranking === null) return 2;
  return app.ranking.position === null ? 1 : 0;
};

export function sortBreakdown(
  apps: readonly KeywordBreakdownApp[],
): KeywordBreakdownApp[] {
  return [...apps].sort(
    (a, b) =>
      Number(b.isYou) - Number(a.isYou) ||
      rankGroup(a) - rankGroup(b) ||
      (a.ranking?.position ?? 0) - (b.ranking?.position ?? 0) ||
      (a.name ?? '').localeCompare(b.name ?? '', 'en'),
  );
}
