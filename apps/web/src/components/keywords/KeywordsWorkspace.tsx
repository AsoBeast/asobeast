"use client";

import { Suspense } from "react";
import { Info, Plus, Upload } from "lucide-react";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { countryParser } from "@/lib/search-params";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { ImportKeywordsDialog } from "./ImportKeywordsDialog";
import { KeywordFieldEditor } from "./KeywordFieldEditor";
import { KeywordsToolbar } from "./KeywordsToolbar";
import { KeywordsTable } from "./KeywordsTable";
import { KeywordsTableSkeleton } from "./skeletons";
import { KeywordCombinations } from "./KeywordCombinations";
import { SuggestionsPanel } from "./SuggestionsPanel";

export function KeywordsWorkspace({
  id,
  homeCountry,
  store,
}: {
  id: string;
  homeCountry: string;
  store: Store;
}) {
  const [country] = useQueryState("country", countryParser);
  const market = country || homeCountry;

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
            <Button>
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
      <Suspense fallback={<KeywordsTableSkeleton />}>
        <KeywordsTable id={id} store={store} country={market} />
      </Suspense>
      <SuggestionsPanel id={id} country={market} store={store} />
      <KeywordCombinations
        id={id}
        store={store}
        homeCountry={homeCountry}
        market={market}
      />
      {store === "APP_STORE" ? (
        <KeywordFieldEditor
          id={id}
          homeCountry={homeCountry}
          activeMarket={market}
        />
      ) : null}
    </div>
  );
}
