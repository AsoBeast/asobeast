import { Store } from '@prisma/client';
import {
  countChars,
  KEYWORD_FIELD_CHAR_LIMIT,
  lintDescription,
  lintKeywordField,
  lintShortDescription,
  lintSubtitle,
  lintTitle,
  LintContext,
  MetadataField,
  MetadataFieldAudit,
  STORE_FIELD_LIMITS,
  tokenize,
} from '@asobeast/shared';

export interface ListingFieldTexts {
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
  keywordField: string;
}

export const listingFieldTexts = (
  view: Omit<ListingFieldTexts, 'keywordField'> | undefined,
  keywordField: string,
): ListingFieldTexts => ({
  title: view?.title ?? '',
  subtitle: view?.subtitle ?? null,
  summary: view?.summary ?? null,
  description: view?.description ?? '',
  keywordField,
});

export interface LintSubject {
  appName: string | null;
  competitorNames: readonly string[];
  trackedKeywords: readonly string[];
}

export const lintContextOf = (
  texts: Pick<ListingFieldTexts, 'title' | 'subtitle'>,
  subject: LintSubject,
): LintContext => ({
  titleWords: tokenize(texts.title),
  subtitleWords: tokenize(texts.subtitle ?? ''),
  brandTokens: tokenize(subject.appName ?? ''),
  competitorNames: [...subject.competitorNames],
  trackedKeywords: [...subject.trackedKeywords],
});

export const listingFieldAudits = (
  store: Store,
  texts: ListingFieldTexts,
  context: LintContext,
): MetadataFieldAudit[] =>
  store === Store.GOOGLE_PLAY
    ? playFieldAudits(texts, context)
    : appStoreFieldAudits(texts, context);

function playFieldAudits(
  texts: ListingFieldTexts,
  context: LintContext,
): MetadataFieldAudit[] {
  const store = Store.GOOGLE_PLAY;
  const summary = texts.summary ?? '';
  return [
    fieldAudit(store, 'title', texts.title, lintTitle(texts.title, 30, store)),
    fieldAudit(
      store,
      'shortDescription',
      summary,
      lintShortDescription(summary, context, 80),
    ),
    fieldAudit(
      store,
      'description',
      texts.description,
      lintDescription(
        texts.description,
        STORE_FIELD_LIMITS.GOOGLE_PLAY.description!.limit,
      ),
    ),
  ];
}

function appStoreFieldAudits(
  texts: ListingFieldTexts,
  context: LintContext,
): MetadataFieldAudit[] {
  const store = Store.APP_STORE;
  const subtitle = texts.subtitle ?? '';
  const keywordField =
    texts.keywordField.length > 0
      ? [
          fieldAudit(
            store,
            'keywordField',
            texts.keywordField,
            lintKeywordField(
              texts.keywordField,
              context,
              KEYWORD_FIELD_CHAR_LIMIT,
            ),
          ),
        ]
      : [];
  return [
    fieldAudit(store, 'title', texts.title, lintTitle(texts.title, 30, store)),
    fieldAudit(
      store,
      'subtitle',
      subtitle,
      lintSubtitle(subtitle, context, 30),
    ),
    ...keywordField,
    fieldAudit(
      store,
      'description',
      texts.description,
      lintDescription(
        texts.description,
        STORE_FIELD_LIMITS.APP_STORE.description!.limit,
      ),
    ),
  ];
}

function fieldAudit(
  store: Store,
  field: MetadataField,
  value: string,
  issues: MetadataFieldAudit['issues'],
): MetadataFieldAudit {
  const limit = STORE_FIELD_LIMITS[store][field]!;
  return {
    field,
    value,
    chars: countChars(value),
    limit: limit.limit,
    indexed: limit.indexed,
    issues,
  };
}
