"use client";

import { Suspense, useRef } from "react";
import { Plus, Upload } from "lucide-react";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { countryParser } from "@/lib/search-params";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { DiscoveredKeywords } from "./discovery/DiscoveredKeywords";
import { KeywordsTabs, useKeywordsTab } from "./discovery/KeywordsTabs";
import { ImportKeywordsDialog } from "./ImportKeywordsDialog";
import { KeywordMarketSelect } from "./KeywordMarketSelect";
import { KeywordViewSwitch } from "./KeywordViewSwitch";
import { TrackedKeywordsTab } from "./TrackedKeywordsTab";

export function KeywordsWorkspace({
  id,
  homeCountry,
  store,
  keywordFields,
  discoveries,
}: {
  id: string;
  homeCountry: string;
  store: Store;
  keywordFields: boolean;
  discoveries: boolean;
}) {
  const [country] = useQueryState("country", countryParser);
  const [tab] = useKeywordsTab();
  const market = country || homeCountry;
  const discovered = discoveries && tab === "discovered";
  const addKeywords = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {discoveries ? <KeywordsTabs id={id} market={market} /> : null}
        <Suspense fallback={null}>
          <KeywordMarketSelect id={id} store={store} market={market} />
        </Suspense>
        {discovered ? null : (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <KeywordViewSwitch />
            <ImportKeywordsDialog appId={id} store={store} country={market}>
              <Button variant="outline">
                <Upload />
                <span className="max-sm:sr-only">Import CSV</span>
              </Button>
            </ImportKeywordsDialog>
            <AddKeywordsDialog appId={id} store={store} country={market}>
              <Button ref={addKeywords}>
                <Plus />
                Add keywords
              </Button>
            </AddKeywordsDialog>
          </div>
        )}
      </div>
      {discovered ? (
        <DiscoveredKeywords id={id} store={store} market={market} />
      ) : (
        <TrackedKeywordsTab
          id={id}
          homeCountry={homeCountry}
          store={store}
          keywordFields={keywordFields}
          clearFocus={addKeywords}
        />
      )}
    </div>
  );
}
