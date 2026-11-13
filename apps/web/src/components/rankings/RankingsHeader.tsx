"use client";

import { Suspense } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { formatCountry, formatNumber, pluralize } from "@/lib/format";
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
      <SelectTrigger aria-label="Report markets" className="print:hidden">
        <SelectValue>
          <span className="font-medium">
            {country ? formatCountry(country) : "All markets"}
          </span>
          {markets ? (
            <span className={COUNT}>
              {formatNumber(country ? (current?.count ?? 0) : total)}
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_MARKETS}>
          <span>All markets</span>
          {markets ? (
            <span className={COUNT}>{formatNumber(total)}</span>
          ) : null}
        </SelectItem>
        {choices.map((choice) => (
          <SelectItem key={choice.country} value={choice.country}>
            <span>{formatCountry(choice.country)}</span>
            <span className={COUNT}>{formatNumber(choice.count)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EntrantsSentence({ id }: { id: string }) {
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
      <span className={FIGURE}>{pluralize(apps, "app")}</span>
      <span>{` entered your top 10 in the last ${days} days.`}</span>
    </span>
  );
}

function RankingsLede({ id }: { id: string }) {
  const [country] = useQueryState("country", countryParser);
  const { data: tracked, dataUpdatedAt } = useSuspenseQuery(
    keywordsOptions(id),
  );
  const scoped = country
    ? tracked.filter((item) => item.country === country)
    : tracked;
  if (scoped.length === 0) return null;
  const moved = movesSentence(keywordMoves(scoped, utcDayOf(dataUpdatedAt)));

  return (
    <>
      <span className={FIGURE}>{pluralize(scoped.length, "keyword")}</span>
      <span>{` in ${country ? formatCountry(country) : "all markets"}.`}</span>
      {moved === null ? null : <span>{` ${moved}`}</span>}
      <Suspense fallback={null}>
        <EntrantsSentence id={id} />
      </Suspense>
    </>
  );
}

export function RankingsHeader({ id }: { id: string }) {
  return (
    <PageHeader
      title="Rankings"
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
