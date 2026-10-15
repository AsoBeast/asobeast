"use client";

import { Columns3, TableProperties } from "lucide-react";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { chartViewParser, type ChartView } from "@/lib/search-params";

export function ChartViewSwitch({
  view,
  onChange,
}: {
  view: ChartView;
  onChange: (view: ChartView) => void;
}) {
  return (
    <Tabs
      value={view}
      onValueChange={(next) => onChange(chartViewParser.parse(next) ?? view)}
    >
      <TabsList aria-label="Layout">
        <TabsOption value="columns" aria-label="Side by side">
          <Columns3 aria-hidden />
        </TabsOption>
        <TabsOption value="table" aria-label="Table">
          <TableProperties aria-hidden />
        </TabsOption>
      </TabsList>
    </Tabs>
  );
}
