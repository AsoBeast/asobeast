"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryState, useQueryStates } from "nuqs";
import { utcDayOf, type CompetitorGaps } from "@asobeast/shared";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatCountry } from "@/lib/format";
import {
  GAP_TAB_LABELS,
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
  const [tab, setTab] = useQueryState("gaps", GAP_TAB_STATE);
  const [params, setParams] = useQueryStates(gapTableParsers, {
    urlKeys: GAP_URL_KEYS,
  });
  const markets = gapMarkets(gaps.coverage, home);
  const country = markets.includes(params.country) ? params.country : "";
  const scope = useGapScope(appId, markets.length > 1, today);
  const counts = gapCounts(gaps, country, home);
  const rows = gapRows(gaps, tab, country, home);
  const empty = gapEmpty(gaps.coverage, country);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {markets.length > 1 ? (
          <SelectFilter
            title="Gap market"
            value={country === "" ? ALL_MARKETS : country}
            options={marketOptions(markets)}
            onChange={(next) =>
              void setParams({ country: next === ALL_MARKETS ? null : next })
            }
          />
        ) : null}
        <Tabs
          value={tab}
          onValueChange={(next) => void setTab(next as GapTab)}
          className="max-w-full min-w-0"
        >
          <TabsList aria-label="Gap lists" scrollable>
            {GAP_TABS.map((value) => (
              <TabsOption key={value} value={value}>
                {`${GAP_TAB_LABELS[value]} (${empty === "none" ? counts[value] : 0})`}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {empty !== "none" || rows.length === 0 ? (
        <GapEmpty kind={empty} tab={tab} country={country} />
      ) : (
        <GapTable
          appId={appId}
          tab={tab}
          rows={rows}
          marketName={country === "" ? null : formatCountry(country)}
          scope={scope}
          params={params}
          setParams={setParams}
        />
      )}
    </div>
  );
}

function GapAnalysisBody({ id }: { id: string }) {
  const read = useQuery(competitorAnalysisOptions(id));
  const { data: app } = useQuery(appDetailOptions(id));
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="The gap analysis could not be loaded."
        read={read}
      />
    );
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
  return (
    <CollapsibleCard
      section={COMPETITOR_SECTION.gaps}
      eyebrow="Gap analysis"
      title="Where competitors beat you"
      actions={<GapHelp />}
    >
      <GapAnalysisBody id={id} />
    </CollapsibleCard>
  );
}
