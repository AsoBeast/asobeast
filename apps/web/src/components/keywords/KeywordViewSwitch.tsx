"use client";

import { ChartScatter, TableProperties } from "lucide-react";
import { useQueryState } from "nuqs";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { keywordViewParser } from "@/lib/search-params";

export function KeywordViewSwitch() {
  const [view, setView] = useQueryState("view", keywordViewParser);
  return (
    <Tabs
      value={view}
      onValueChange={(next) =>
        void setView(keywordViewParser.parse(next) ?? view)
      }
    >
      <TabsList aria-label="Keyword view">
        <TabsOption value="table">
          <TableProperties aria-hidden />
          <span className="max-sm:sr-only">Table</span>
        </TabsOption>
        <TabsOption value="map">
          <ChartScatter aria-hidden />
          <span className="max-sm:sr-only">Map</span>
        </TabsOption>
      </TabsList>
    </Tabs>
  );
}
