"use client";

import { Suspense } from "react";
import { Info, Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { countryParser } from "@/lib/search-params";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { KeywordFieldEditor } from "./KeywordFieldEditor";
import { KeywordsToolbar } from "./KeywordsToolbar";
import { KeywordsTable } from "./KeywordsTable";
import { KeywordsTableSkeleton } from "./skeletons";
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-balance">
            Tracked keywords
          </h2>
          <p className="text-sm text-muted-foreground">
            The phrases you want this app to rank for, tracked per market.
          </p>
        </div>
        <AddKeywordsDialog appId={id} country={market}>
          <Button>
            <Plus />
            Add keywords
          </Button>
        </AddKeywordsDialog>
      </div>
      <Suspense fallback={null}>
        <KeywordsToolbar id={id} market={market} homeCountry={homeCountry} />
      </Suspense>
      <Alert role="note">
        <Info />
        <AlertDescription>
          Apple App Store and Google Play traffic and volume scores use
          different public signals and are not directly comparable.
        </AlertDescription>
      </Alert>
      <Suspense fallback={<KeywordsTableSkeleton />}>
        <KeywordsTable id={id} country={market} />
      </Suspense>
      <SuggestionsPanel id={id} country={market} />
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
