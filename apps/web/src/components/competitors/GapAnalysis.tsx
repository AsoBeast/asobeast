"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState, useQueryStates } from "nuqs";
import { utcDayOf, type CompetitorGaps } from "@asobeast/shared";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  gapTabLabel,
  GAP_TABS,
  gapCounts,
  gapEmpty,
  gapRows,
  type GapTab,
} from "@/lib/gap-lists";
import {
  appDetailOptions,
  competitorAnalysisOptions,
  competitorsOptions,
} from "@/lib/queries";
import {
  GAP_URL_KEYS,
  gapTableParsers,
  gapTabParser,
} from "@/lib/search-params";
import { useOpenBreakdown } from "./breakdown-opener";
import { ALL_MARKETS, gapMarkets, marketOptions } from "./comparison-markets";
import { COMPETITOR_SECTION } from "./competitor-sections";
import { GapEmpty } from "./GapEmpty";
import { GapHelp } from "./GapHelp";
import { GapTable } from "./GapTable";
import type { GapColumnScope } from "./gap-columns";
import { coverageLine } from "./gap-coverage";
import { SECTION_BODY, SECTION_TOOLBAR } from "./section-layout";
import { GapAnalysisSkeleton } from "./skeletons";

const GAP_TAB_STATE = gapTabParser.withOptions({ history: "push" });

function useGapScope(
  appId: string,
  multiMarket: boolean,
  today: string,
): GapColumnScope {
  const { data: competitors } = useQuery(competitorsOptions(appId));
  const onOpenBreakdown = useOpenBreakdown();
  return useMemo(
    () => ({
      competitors: new Map(
        (competitors ?? []).map((item) => [
          item.id,
          { name: item.name, iconUrl: item.iconUrl },
        ]),
      ),
      multiMarket,
      today,
      onOpenBreakdown,
    }),
    [competitors, multiMarket, today, onOpenBreakdown],
  );
}

function GapLists({
  appId,
  gaps,
  home,
  today,
}: {
  appId: string;
  gaps: CompetitorGaps;
  home: string;
  today: string;
}) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const [tab, setTab] = useQueryState("gaps", GAP_TAB_STATE);
  const [params, setParams] = useQueryStates(gapTableParsers, {
    urlKeys: GAP_URL_KEYS,
  });
  const markets = gapMarkets(gaps.coverage, home, locale);
  const country = markets.includes(params.country) ? params.country : "";
  const scope = useGapScope(appId, markets.length > 1, today);
  const counts = gapCounts(gaps, country, home);
  const rows = gapRows(gaps, tab, country, home);
  const empty = gapEmpty(gaps.coverage, country);
  const coverage = coverageLine(gaps.coverage, country, t);

  const listed = empty === "none" && rows.length > 0;

  return (
    <div className={SECTION_BODY}>
      <div className={SECTION_TOOLBAR}>
        <Tabs
          value={tab}
          onValueChange={(next) => void setTab(next as GapTab)}
          className="max-w-full min-w-0"
        >
          <TabsList aria-label={t("gaps.lists")} scrollable>
            {GAP_TABS.map((value) => {
              const count = empty === "none" ? counts[value] : 0;
              const label = gapTabLabel(value, t);
              return (
                <TabsOption
                  key={value}
                  value={value}
                  aria-label={`${label} (${count})`}
                >
                  <span>{label}</span>
                  <span className="numeric text-muted-foreground">
                    {String(count)}
                  </span>
                </TabsOption>
              );
            })}
          </TabsList>
        </Tabs>
        {markets.length > 1 ? (
          <div className="sm:ml-auto">
            <SelectFilter
              title={t("gaps.market")}
              value={country === "" ? ALL_MARKETS : country}
              options={marketOptions(markets, t, locale)}
              onChange={(next) =>
                void setParams({ country: next === ALL_MARKETS ? null : next })
              }
            />
          </div>
        ) : null}
      </div>
      {listed ? (
        <GapTable
          appId={appId}
          tab={tab}
          rows={rows}
          marketName={
            country === "" ? null : formatCountryInLocale(country, locale)
          }
          scope={scope}
          params={params}
          setParams={setParams}
          footer={coverage}
        />
      ) : (
        <GapEmpty kind={empty} tab={tab} country={country} />
      )}
    </div>
  );
}

function GapAnalysisBody({ id }: { id: string }) {
  const t = useTranslations("competitors");
  const read = useQuery(competitorAnalysisOptions(id));
  const { data: app } = useQuery(appDetailOptions(id));
  if (failedRead(read)) {
    return <InlineQueryError message={t("gaps.loadFailed")} read={read} />;
  }
  if (read.data === undefined || app === undefined) {
    return <GapAnalysisSkeleton />;
  }
  return (
    <GapLists
      appId={id}
      gaps={read.data.gaps}
      home={app.country}
      today={utcDayOf(read.dataUpdatedAt)}
    />
  );
}

export function GapAnalysis({ id }: { id: string }) {
  const t = useTranslations("competitors");
  return (
    <CollapsibleCard
      section={COMPETITOR_SECTION.gaps}
      title={t("gaps.title")}
      actions={<GapHelp />}
    >
      <GapAnalysisBody id={id} />
    </CollapsibleCard>
  );
}
