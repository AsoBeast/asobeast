"use client";

import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { countryParser } from "@/lib/search-params";
import { DiscoveredKeywords } from "./discovery/DiscoveredKeywords";
import { KeywordsTabs, useKeywordsTab } from "./discovery/KeywordsTabs";
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

  return (
    <div className="flex flex-col gap-6">
      {discoveries ? <KeywordsTabs id={id} market={market} /> : null}
      {discoveries && tab === "discovered" ? (
        <DiscoveredKeywords
          id={id}
          store={store}
          market={market}
          homeCountry={homeCountry}
        />
      ) : (
        <TrackedKeywordsTab
          id={id}
          homeCountry={homeCountry}
          store={store}
          keywordFields={keywordFields}
        />
      )}
    </div>
  );
}
