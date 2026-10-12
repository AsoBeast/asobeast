import { Store } from '@prisma/client';
import {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  KeywordBreakdownLocalization,
  MetadataField,
  normalizeText,
  searchKey,
  tokenize,
} from '@asobeast/shared';
import { containsTerm } from '../common/text/scripts';
import { accentTermsOf, placementOf } from './keyword-breakdown.insights';
import { LocalizedRead } from './keyword-breakdown.listings';
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
  localized?: LocalizedRead;
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
    return { field, value: null, phrase: false, terms: [], looseTerms: [] };
  }
  const text = normalizeText(value);
  const folded = searchKey(value);
  const matched = terms.filter((term) => containsTerm(folded, searchKey(term)));
  return {
    field,
    value,
    phrase: coversKeyword(folded, searchKey(keyword)),
    terms: matched,
    looseTerms: matched.filter((term) => !containsTerm(text, term)),
  };
}

const termsIn = (fields: readonly KeywordBreakdownField[]): number =>
  new Set(fields.flatMap((entry) => entry.terms)).size;

const copyKey = (title: string | null, subtitle: string | null): string =>
  `${normalizeText(title ?? '')}|${normalizeText(subtitle ?? '')}`;

function localizations(
  subject: BreakdownSubject,
  keyword: string,
  terms: readonly string[],
): KeywordBreakdownLocalization[] {
  const seen = new Set(
    subject.listing
      ? [copyKey(subject.listing.title, subject.listing.subtitle)]
      : [],
  );
  const read: KeywordBreakdownLocalization[] = [];
  for (const copy of subject.localized?.listings ?? []) {
    const key = copyKey(copy.title, copy.subtitle);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const fields = [
      judgeField('title', copy.title, keyword, terms),
      judgeField('subtitle', copy.subtitle, keyword, terms),
    ];
    read.push({
      localization: copy.localization,
      sourceCountry: copy.sourceCountry,
      fields,
      matchedTerms: termsIn(fields),
    });
  }
  return read;
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
  const localized = localizations(subject, keyword, terms);
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
    matchedTerms: Math.max(
      termsIn(fields),
      ...localized.map((entry) => entry.matchedTerms),
    ),
    localizations: localized,
    unreadLocalizations: [...(subject.localized?.unread ?? [])],
    placement: placementOf({ fields, localizations: localized }, terms.length),
    accentTerms: accentTermsOf(
      { fields, localizations: localized },
      terms.length,
    ),
    insight: null,
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
