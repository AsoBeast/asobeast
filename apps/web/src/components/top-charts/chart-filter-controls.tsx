"use client";

import {
  CATEGORY_COLLECTIONS,
  chartDevicesOf,
  type CategoryCollection,
  type ChartCompareWindow,
  type ChartDevice,
  type ChartKey,
} from "@asobeast/shared";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import type { ChartView } from "@/lib/search-params";
import { ChartCountry } from "./ChartCountry";
import { showsDevice } from "./chart-filters";
import { COLLECTION_LABELS, type ChartSearchUpdate } from "./chart-params";
import { ChartViewSwitch } from "./ChartViewSwitch";
import { GenreSelect } from "./GenreSelect";

const COMPARE_OPTIONS: ReadonlyArray<{
  value: ChartCompareWindow;
  label: string;
}> = [
  { value: "1d", label: "vs previous day" },
  { value: "7d", label: "vs 7 days ago" },
  { value: "30d", label: "vs 30 days ago" },
];

const DEVICE_LABELS: Record<ChartDevice, string> = {
  iphone: "iPhone",
  android: "Android",
};

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
  if (view !== "table") return null;
  return (
    <Tabs
      value={chart.collection}
      onValueChange={(next) =>
        onChange({ collection: next as CategoryCollection })
      }
    >
      <TabsList aria-label="Chart">
        {CATEGORY_COLLECTIONS.map((collection) => (
          <TabsOption key={collection} value={collection}>
            {COLLECTION_LABELS[collection]}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function ChartCompareFilter({ compare, onChange }: ChartFilterProps) {
  return (
    <SelectFilter
      title="Compare"
      value={compare}
      options={COMPARE_OPTIONS}
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
  if (!showsDevice(chart.store)) return null;
  return (
    <SelectFilter
      title="Device"
      value={chart.device}
      options={chartDevicesOf(chart.store).map((device) => ({
        value: device,
        label: DEVICE_LABELS[device],
      }))}
      onChange={(device) => onChange({ device })}
    />
  );
}
