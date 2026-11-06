"use client";

import { Suspense, useRef, type RefObject } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Info, Plus, Upload } from "lucide-react";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { keywordsOptions } from "@/lib/queries";
import {
  countryParser,
  keywordChartSelectionParser,
  keywordViewParser,
  type KeywordChartSelection,
} from "@/lib/search-params";
import { resolveChartSelection } from "./dynamics-selection";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { ImportKeywordsDialog } from "./ImportKeywordsDialog";
import { KeywordDynamicsPanel } from "./KeywordDynamicsPanel";
import { KeywordsToolbar } from "./KeywordsToolbar";
import { MarketSearchReadsCard } from "./MarketSearchReadsCard";
import { KeywordsTable } from "./KeywordsTable";
import { KeywordMapSkeleton, KeywordsTableSkeleton } from "./skeletons";
import { KeywordCombinations } from "./KeywordCombinations";
import { SuggestionsPanel } from "./SuggestionsPanel";

export function TrackedKeywordsTab({
  id,
  homeCountry,
  store,
  keywordFields,
}: {
  id: string;
  homeCountry: string;
  store: Store;
  keywordFields: boolean;
}) {
  const [country] = useQueryState("country", countryParser);
  const [view] = useQueryState("view", keywordViewParser);
  const [selection] = useQueryState("keywords", keywordChartSelectionParser);
  const market = country || homeCountry;
  const clearFocus = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-balance">
            Tracked keywords
          </h2>
          <p className="text-sm text-muted-foreground">
            The phrases you want this app to rank for, tracked per market.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportKeywordsDialog appId={id} store={store} country={market}>
            <Button variant="outline">
              <Upload />
              Import CSV
            </Button>
          </ImportKeywordsDialog>
          <AddKeywordsDialog appId={id} store={store} country={market}>
            <Button ref={clearFocus}>
              <Plus />
              Add keywords
            </Button>
          </AddKeywordsDialog>
        </div>
      </div>
      <Suspense fallback={null}>
        <KeywordsToolbar
          id={id}
          store={store}
          market={market}
          homeCountry={homeCountry}
        />
      </Suspense>
      <Alert role="note">
        <Info />
        <AlertDescription>
          Apple App Store and Google Play popularity and volume scores use
          different public signals and are not directly comparable.
        </AlertDescription>
      </Alert>
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
  return (
    <>
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
