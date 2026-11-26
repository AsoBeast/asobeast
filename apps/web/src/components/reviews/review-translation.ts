import {
  REVIEW_TRANSLATION_LANGUAGE,
  UNKNOWN_LANGUAGE,
  type ReviewItem,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { replyLanguageName } from "./reply-language";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

export function translationCaption(
  sourceLanguage: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return sourceLanguage === UNKNOWN_LANGUAGE
    ? t("translation.unknown")
    : t("translation.caption", {
        language: replyLanguageName(sourceLanguage, locale),
      });
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
