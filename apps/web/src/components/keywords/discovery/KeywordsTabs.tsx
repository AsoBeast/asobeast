"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { discoveryTabLabel } from "@/lib/keyword-discoveries";
import { keywordDiscoveriesOptions, keywordsOptions } from "@/lib/queries";
import {
  DISCOVERY_URL_KEYS,
  discoveryStateParser,
  discoveryTableParsers,
  keywordsTabParser,
  type KeywordsTab,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const DISCOVERED_TAB_ID = "keywords-discovered-tab";

const TAB_PARAMS = {
  tab: keywordsTabParser.withOptions({ history: "push" }),
  state: discoveryStateParser,
  [DISCOVERY_URL_KEYS.sort]: discoveryTableParsers.sort,
  [DISCOVERY_URL_KEYS.dir]: discoveryTableParsers.dir,
  [DISCOVERY_URL_KEYS.q]: discoveryTableParsers.q,
};

const CLEARED_TABLE = {
  [DISCOVERY_URL_KEYS.sort]: null,
  [DISCOVERY_URL_KEYS.dir]: null,
  [DISCOVERY_URL_KEYS.q]: null,
};

export function useKeywordsTab() {
  const [{ tab }, setParams] = useQueryStates(TAB_PARAMS);
  const setTab = (next: KeywordsTab) =>
    void setParams({
      tab: next === "tracked" ? null : next,
      state: null,
      ...CLEARED_TABLE,
    });
  return [tab, setTab] as const;
}

export function KeywordsTabs({ id, market }: { id: string; market: string }) {
  const [tab, setTab] = useKeywordsTab();
  const { data: tracked } = useQuery(keywordsOptions(id, market));
  const { data: discovered } = useQuery(keywordDiscoveriesOptions(id, market));
  const discoveredLabel = discoveryTabLabel(discovered?.counts);
  const unseen = tab !== "discovered" && (discovered?.counts.all ?? 0) > 0;

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(keywordsTabParser.parse(next) ?? tab)}
      className="max-w-full min-w-0"
    >
      <TabsList aria-label="Keyword lists" scrollable>
        <TabsOption value="tracked">
          {tracked ? `Tracked ${tracked.length}` : "Tracked"}
        </TabsOption>
        <TabsOption
          id={DISCOVERED_TAB_ID}
          value="discovered"
          aria-label={
            unseen ? `${discoveredLabel}, new discoveries to review` : undefined
          }
        >
          <span>{discoveredLabel}</span>
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full bg-brand-mark",
              unseen ? "visible" : "invisible",
            )}
          />
        </TabsOption>
      </TabsList>
    </Tabs>
  );
}
