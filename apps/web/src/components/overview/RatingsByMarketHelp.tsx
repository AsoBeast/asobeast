"use client";

import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";
import { PRODUCT_NAME } from "@/lib/brand";

export const RATINGS_BY_MARKET_GUIDE =
  "https://docs.asobeast.com/guides/reviews#compare-ratings-across-markets";

export function RatingsByMarketHelp() {
  const t = useTranslations("overview");
  return (
    <InfoTip
      label={t("ratingsByMarket.about")}
      title={t("ratingsByMarket.helpTitle")}
      summary={t("ratingsByMarket.helpSummary", { product: PRODUCT_NAME })}
    >
      <p className="text-muted-foreground">{t("ratingsByMarket.helpDetail")}</p>
      <a
        href={RATINGS_BY_MARKET_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("ratingsByMarket.readRatings")}
      </a>
    </InfoTip>
  );
}
