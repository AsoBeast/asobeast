import { REVIEW_TRANSLATION_LANGUAGE, type ReviewItem } from "@asobeast/shared";
import { replyLanguageName } from "./reply-language";

const UNKNOWN_LANGUAGE = "und";

export function translationCaption(sourceLanguage: string): string {
  return sourceLanguage === UNKNOWN_LANGUAGE
    ? "Translated by AI"
    : `Translated from ${replyLanguageName(sourceLanguage)} by AI`;
}

export function primaryLanguage(tag: string | null | undefined): string | null {
  const primary = tag?.split(/[-_]/)[0]?.toLowerCase() ?? "";
  return REVIEW_TRANSLATION_LANGUAGE.test(primary) ? primary : null;
}

const hasWords = (review: ReviewItem) =>
  Boolean(review.title?.trim() || review.text.trim());

export function offersTranslation(
  review: ReviewItem,
  viewer: string | null,
  fallback: string | null,
): boolean {
  if (viewer === null || !hasWords(review)) return false;
  const source = primaryLanguage(
    review.translation?.sourceLanguage ?? review.language ?? fallback,
  );
  return source !== null && source !== viewer;
}

export function keptTranslation(review: ReviewItem, viewer: string | null) {
  const kept = review.translation;
  return viewer !== null && kept?.language === viewer ? kept : null;
}
