import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDateInLocale, formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const staleCheckLine = (
  day: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
) =>
  t("position.staleLine", {
    date: formatDateInLocale(day, locale),
  });

export const staleCheckLabel = (
  day: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
) => t("position.staleLabel", { day: formatDayMonthInLocale(day, locale) });
