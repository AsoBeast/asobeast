"use client";

import {
  CATEGORY_COLLECTIONS,
  chartDevicesOf,
  type CategoryCollection,
  type ChartCompareWindow,
  type ChartKey,
} from "@asobeast/shared";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import type { ChartView } from "@/lib/search-params";
import { ChartCountry } from "./ChartCountry";
import { showsDevice } from "./chart-filters";
import { collectionLabel, type ChartSearchUpdate } from "./chart-params";
import { ChartViewSwitch } from "./ChartViewSwitch";
import { GenreSelect } from "./GenreSelect";

export interface ChartFilterProps {
  chart: ChartKey;
  view: ChartView;
  compare: ChartCompareWindow;
  onChange: (next: ChartSearchUpdate) => void;
}

export function ChartCountryFilter({ chart, onChange }: ChartFilterProps) {
  return (
    <ChartCountry
      store={chart.store}
      country={chart.country}
      onChange={(country) => onChange({ country })}
    />
  );
}

export function ChartGenreFilter({ chart, onChange }: ChartFilterProps) {
  return (
    <GenreSelect
      store={chart.store}
      value={chart.genre}
      onChange={(genre) => onChange({ genre })}
    />
  );
}

export function ChartKindFilter({ chart, view, onChange }: ChartFilterProps) {
  const t = useTranslations("topCharts");
  if (view !== "table") return null;
  return (
    <Tabs
      value={chart.collection}
      onValueChange={(next) =>
        onChange({ collection: next as CategoryCollection })
      }
    >
      <TabsList aria-label={t("chart")}>
        {CATEGORY_COLLECTIONS.map((collection) => (
          <TabsOption key={collection} value={collection}>
            {collectionLabel(collection, t)}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function ChartCompareFilter({ compare, onChange }: ChartFilterProps) {
  const t = useTranslations("topCharts");
  const options: ReadonlyArray<{ value: ChartCompareWindow; label: string }> = [
    { value: "1d", label: t("compareOptions.1d") },
    { value: "7d", label: t("compareOptions.7d") },
    { value: "30d", label: t("compareOptions.30d") },
  ];
  return (
    <SelectFilter
      title={t("compare")}
      value={compare}
      options={options}
      onChange={(next) => onChange({ compare: next })}
    />
  );
}

export function ChartLayoutFilter({ view, onChange }: ChartFilterProps) {
  return (
    <ChartViewSwitch
      view={view}
      onChange={(next) => onChange({ view: next })}
    />
  );
}

export function ChartDeviceFilter({ chart, onChange }: ChartFilterProps) {
  const t = useTranslations("topCharts");
  if (!showsDevice(chart.store)) return null;
  return (
    <SelectFilter
      title={t("device")}
      value={chart.device}
      options={chartDevicesOf(chart.store).map((device) => ({
        value: device,
        label: t(`devices.${device}`),
      }))}
      onChange={(device) => onChange({ device })}
    />
  );
}
