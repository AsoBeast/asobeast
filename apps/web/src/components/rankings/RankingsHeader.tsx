"use client";

import { Suspense } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { utcDayOf } from "@asobeast/shared";
import { PrintReportButton } from "@/components/app-detail/PrintReportButton";
import { marketChoices } from "@/components/keywords/market-choices";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCountryInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { keywordMoves, movesSentence } from "@/lib/keyword-day-change";
import {
  keywordCountriesOptions,
  keywordsOptions,
  serpMoversOptions,
} from "@/lib/queries";
import { countryParser, moverDaysParser } from "@/lib/search-params";

const ALL_MARKETS = "all";

const COUNT = "numeric text-faint-foreground";

const FIGURE = "numeric font-medium text-foreground";

function MarketSelect({ id }: { id: string }) {
  const t = useTranslations("rankings");
  const locale = useAppLocale();
  const [country, setCountry] = useQueryState("country", countryParser);
  const { data: markets } = useQuery(keywordCountriesOptions(id));
  const choices = country
    ? marketChoices(markets ?? [], country)
    : (markets ?? []).map((entry) => ({
        country: entry.country,
        count: entry.keywordCount,
      }));
  const total = (markets ?? []).reduce(
    (sum, entry) => sum + entry.keywordCount,
    0,
  );
  const current = choices.find((choice) => choice.country === country);

  return (
    <Select
      value={country || ALL_MARKETS}
      onValueChange={(next) =>
        void setCountry(next === ALL_MARKETS ? null : next)
      }
    >
      <SelectTrigger aria-label={t("reportMarkets")} className="print:hidden">
        <SelectValue>
          <span className="font-medium">
            {country ? formatCountryInLocale(country, locale) : t("allMarkets")}
          </span>
          {markets ? (
            <span className={COUNT}>
              {formatNumberInLocale(
                country ? (current?.count ?? 0) : total,
                locale,
              )}
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_MARKETS}>
          <span>{t("allMarkets")}</span>
          {markets ? (
            <span className={COUNT}>{formatNumberInLocale(total, locale)}</span>
          ) : null}
        </SelectItem>
        {choices.map((choice) => (
          <SelectItem key={choice.country} value={choice.country}>
            <span>{formatCountryInLocale(choice.country, locale)}</span>
            <span className={COUNT}>
              {formatNumberInLocale(choice.count, locale)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EntrantsSentence({ id }: { id: string }) {
  const t = useTranslations("rankings");
  const locale = useAppLocale();
  const [days] = useQueryState("movers", moverDaysParser);
  const [country] = useQueryState("country", countryParser);
  const { data } = useSuspenseQuery(serpMoversOptions(id, days, country));
  const apps = new Set(
    data.items
      .filter((item) => item.appId !== id)
      .map((item) => item.storeAppId),
  ).size;
  if (apps === 0) return null;
  return (
    <span>
      {" "}
      <span className={FIGURE}>
        {t("appCount", { count: formatNumberInLocale(apps, locale) })}
      </span>
      <span>{t("enteredTop10Rest", { days })}</span>
    </span>
  );
}

function RankingsLede({ id }: { id: string }) {
  const t = useTranslations("rankings");
  const keywords = useTranslations("keywords");
  const locale = useAppLocale();
  const [country] = useQueryState("country", countryParser);
  const { data: tracked, dataUpdatedAt } = useSuspenseQuery(
    keywordsOptions(id),
  );
  const scoped = country
    ? tracked.filter((item) => item.country === country)
    : tracked;
  if (scoped.length === 0) return null;
  const moved = movesSentence(
    keywordMoves(scoped, utcDayOf(dataUpdatedAt)),
    keywords,
    locale,
  );

  return (
    <>
      <span className={FIGURE}>
        {t("keywordCount", {
          count: formatNumberInLocale(scoped.length, locale),
        })}
      </span>
      <span>
        {t("inMarket", {
          country: country
            ? formatCountryInLocale(country, locale)
            : t("allMarketsLower"),
        })}
      </span>
      {moved === null ? null : <span>{` ${moved}`}</span>}
      <Suspense fallback={null}>
        <EntrantsSentence id={id} />
      </Suspense>
    </>
  );
}

export function RankingsHeader({ id }: { id: string }) {
  const t = useTranslations("rankings");
  return (
    <PageHeader
      title={t("title")}
      titleHidden
      controls={
        <>
          <MarketSelect id={id} />
          <span className="ml-auto">
            <PrintReportButton />
          </span>
        </>
      }
      lede={<RankingsLede id={id} />}
    />
  );
}
