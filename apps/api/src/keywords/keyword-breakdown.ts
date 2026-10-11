import { Store } from '@prisma/client';
import {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  MetadataField,
  normalizeText,
  tokenize,
} from '@asobeast/shared';
import { containsTerm } from '../common/text/scripts';
import { coversKeyword } from './keyword-coverage';

export interface BreakdownListing {
  country: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
}

export interface BreakdownSubject {
  appId: string;
  name: string | null;
  iconUrl: string | null;
  isYou: boolean;
  position: number | null;
  listing: BreakdownListing | null;
  keywordField?: readonly string[];
}

const SEARCHED_FIELDS: Record<
  Store,
  ReadonlyArray<{
    field: MetadataField;
    read: (listing: BreakdownListing) => string | null;
  }>
> = {
  APP_STORE: [
    { field: 'title', read: (listing) => listing.title },
    { field: 'subtitle', read: (listing) => listing.subtitle },
  ],
  GOOGLE_PLAY: [
    { field: 'title', read: (listing) => listing.title },
    { field: 'shortDescription', read: (listing) => listing.summary },
  ],
};

export function breakdownTerms(keyword: string): string[] {
  return [...new Set(tokenize(keyword))];
}

function judgeField(
  field: MetadataField,
  value: string | null,
  keyword: string,
  terms: readonly string[],
): KeywordBreakdownField {
  if (!value) {
    return { field, value: null, phrase: false, terms: [] };
  }
  const text = normalizeText(value);
  return {
    field,
    value,
    phrase: coversKeyword(value, keyword),
    terms: terms.filter((term) => containsTerm(text, term)),
  };
}

export function breakdownApp(
  subject: BreakdownSubject,
  store: Store,
  keyword: string,
): KeywordBreakdownApp {
  const terms = breakdownTerms(keyword);
  const { listing } = subject;
  const listed = listing
    ? SEARCHED_FIELDS[store].map(({ field, read }) =>
        judgeField(field, read(listing), keyword, terms),
      )
    : [];
  const entered = subject.keywordField ?? [];
  const fields =
    entered.length > 0
      ? [
          ...listed,
          judgeField('keywordField', entered.join(','), keyword, terms),
        ]
      : listed;
  return {
    appId: subject.appId,
    name: subject.name,
    iconUrl: subject.iconUrl,
    isYou: subject.isYou,
    position: subject.position,
    listingCountry: listing?.country ?? null,
    fields,
    matchedTerms: new Set(fields.flatMap((entry) => entry.terms)).size,
    ratingAvg: listing?.ratingAvg ?? null,
    ratingCount: listing?.ratingCount ?? null,
  };
}

export function sortBreakdown(
  apps: readonly KeywordBreakdownApp[],
): KeywordBreakdownApp[] {
  return [...apps].sort((a, b) => {
    if (a.isYou !== b.isYou) {
      return a.isYou ? -1 : 1;
    }
    return (
      (a.position ?? Number.POSITIVE_INFINITY) -
      (b.position ?? Number.POSITIVE_INFINITY)
    );
  });
}
