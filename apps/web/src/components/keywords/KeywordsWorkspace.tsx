"use client";

import type { Store } from "@asobeast/shared";
import { TrackedKeywordsTab } from "./TrackedKeywordsTab";

export function KeywordsWorkspace({
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
  return (
    <TrackedKeywordsTab
      id={id}
      homeCountry={homeCountry}
      store={store}
      keywordFields={keywordFields}
    />
  );
}
