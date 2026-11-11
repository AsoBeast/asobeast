"use client";

import { Suspense, type RefObject } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { keywordsOptions } from "@/lib/queries";
import {
  countryParser,
  keywordChartSelectionParser,
  keywordViewParser,
  type KeywordChartSelection,
} from "@/lib/search-params";
import { resolveChartSelection } from "./dynamics-selection";
import { KeywordDynamicsPanel } from "./KeywordDynamicsPanel";
import { MarketSearchReadsCard } from "./MarketSearchReadsCard";
import { KeywordsTable } from "./KeywordsTable";
import { KeywordMapSkeleton, KeywordsTableSkeleton } from "./skeletons";
import { KeywordCombinations } from "./KeywordCombinations";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { TrackedSummary } from "./TrackedSummary";
import { useEmptiedListFocus } from "./use-keywords-table-focus";

export function TrackedKeywordsTab({
  id,
  homeCountry,
  store,
  keywordFields,
  clearFocus,
}: {
  id: string;
  homeCountry: string;
  store: Store;
  keywordFields: boolean;
  clearFocus: RefObject<HTMLButtonElement | null>;
}) {
  const [country] = useQueryState("country", countryParser);
  const [view] = useQueryState("view", keywordViewParser);
  const [selection] = useQueryState("keywords", keywordChartSelectionParser);
  const market = country || homeCountry;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Tracked keywords</h2>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            {view === "map" ? <KeywordMapSkeleton /> : null}
            <KeywordsTableSkeleton />
          </div>
        }
      >
        <KeywordsMarketScope
          id={id}
          market={market}
          homeCountry={homeCountry}
          store={store}
          selection={selection}
          clearFocus={clearFocus}
        />
      </Suspense>
      <SuggestionsPanel id={id} country={market} store={store} />
      <KeywordCombinations
        id={id}
        store={store}
        homeCountry={homeCountry}
        market={market}
      />
      {keywordFields ? (
        <MarketSearchReadsCard
          id={id}
          homeCountry={homeCountry}
          market={market}
        />
      ) : null}
    </div>
  );
}

function KeywordsMarketScope({
  id,
  market,
  homeCountry,
  store,
  selection,
  clearFocus,
}: {
  id: string;
  market: string;
  homeCountry: string;
  store: Store;
  selection: KeywordChartSelection;
  clearFocus: RefObject<HTMLButtonElement | null>;
}) {
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id, market));
  const chart = resolveChartSelection(selection, tracked);
  const open = selection.mode === "chart";
  useEmptiedListFocus(tracked.length === 0, clearFocus);
  return (
    <>
      <TrackedSummary id={id} market={market} />
      {open ? (
        <KeywordDynamicsPanel
          id={id}
          market={market}
          homeCountry={homeCountry}
          chart={chart}
          clearFocus={clearFocus}
        />
      ) : null}
      <KeywordsTable
        id={id}
        store={store}
        country={market}
        homeCountry={homeCountry}
        chartedIds={open ? chart.charted : []}
      />
    </>
  );
}
