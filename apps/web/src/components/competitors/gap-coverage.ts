import type { CompetitorGapCoverage } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import type { MessageTranslator } from "@/i18n/translator";
import enCompetitors from "../../../messages/en/competitors.json";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

export function coverageLine(
  coverage: CompetitorGapCoverage | undefined,
  country: string,
  t: MessageTranslator = english,
): string | null {
  if (coverage === undefined) return null;
  const markets =
    country === ""
      ? coverage.markets
      : coverage.markets.filter((market) => market.country === country);
  if (markets.length === 0) return null;
  const keywords = markets.reduce((sum, market) => sum + market.keywords, 0);
  const compared = markets.reduce((sum, market) => sum + market.compared, 0);
  const scope =
    markets.length === 1
      ? ""
      : t("gaps.comparedMarketScope", { count: markets.length });
  return t("gaps.compared", { compared, total: keywords, scope });
}
