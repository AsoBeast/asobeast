"use client";

import { Columns3, TableProperties } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { chartViewParser, type ChartView } from "@/lib/search-params";

export function ChartViewSwitch({
  view,
  onChange,
}: {
  view: ChartView;
  onChange: (view: ChartView) => void;
}) {
  const t = useTranslations("topCharts");
  return (
    <Tabs
      value={view}
      onValueChange={(next) => onChange(chartViewParser.parse(next) ?? view)}
    >
      <TabsList aria-label={t("layout")}>
        <TabsOption value="columns" aria-label={t("view.sideBySide")}>
          <Columns3 aria-hidden />
        </TabsOption>
        <TabsOption value="table" aria-label={t("view.table")}>
          <TableProperties aria-hidden />
        </TabsOption>
      </TabsList>
    </Tabs>
  );
}
