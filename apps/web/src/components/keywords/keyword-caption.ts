import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatListInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export interface KeywordCaptionFacts {
  added: boolean;
  playInstalls: boolean;
  competitors: boolean;
  insights: boolean;
  totals: boolean;
}

export function keywordTableCaption(
  { added, playInstalls, competitors, insights, totals }: KeywordCaptionFacts,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const columns = [
    t("caption.source"),
    added ? t("caption.added") : null,
    t("caption.positionChange"),
    t("caption.popularity"),
    t("caption.difficulty"),
    t("caption.opportunity"),
    insights ? t("caption.insights") : null,
    playInstalls ? t("caption.playInstalls") : null,
    t("caption.weekChange"),
    t("caption.volatility"),
    competitors ? t("caption.competitors") : null,
    totals ? t("caption.totals") : null,
  ].filter((column): column is string => column !== null);
  return t("caption.text", { columns: formatListInLocale(columns, locale) });
}
