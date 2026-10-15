"use client";

import type { ReactNode } from "react";
import {
  CATEGORY_COLLECTIONS,
  STORES,
  type CategoryCollection,
  type ChartCompareWindow,
  type ChartKey,
  type Store,
} from "@asobeast/shared";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { storeLabel } from "@/lib/format";
import { ChartCountry } from "./ChartCountry";
import { ChartDayPicker } from "./ChartDayPicker";
import {
  COLLECTION_LABELS,
  storeChanged,
  type ChartSearchUpdate,
} from "./chart-params";
import { GenreSelect } from "./GenreSelect";

const COMPARE_OPTIONS: ReadonlyArray<{
  value: ChartCompareWindow;
  label: string;
}> = [
  { value: "1d", label: "vs previous day" },
  { value: "7d", label: "vs 7 days ago" },
  { value: "30d", label: "vs 30 days ago" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden className="text-caption text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function DeviceSelect() {
  return (
    <Select value="iphone">
      <SelectTrigger aria-label="Device" className="w-[200px]">
        <SelectValue>iPhone</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="iphone">iPhone</SelectItem>
        <SelectItem value="ipad" disabled>
          iPad · not captured yet
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ChartFilters({
  chart,
  withKind,
  compare,
  day,
  dates,
  onChange,
}: {
  chart: ChartKey;
  withKind: boolean;
  compare: ChartCompareWindow;
  day: string | null;
  dates: readonly string[];
  onChange: (next: ChartSearchUpdate) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Store">
        <Tabs
          value={chart.store}
          onValueChange={(next) => onChange(storeChanged(next as Store, chart))}
        >
          <TabsList aria-label="Store">
            {STORES.map((store) => (
              <TabsOption key={store} value={store}>
                {storeLabel(store)}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      </Field>
      <Field label="Country">
        <ChartCountry
          key={`${chart.store}~${chart.country}`}
          store={chart.store}
          country={chart.country}
          onChange={(country) => onChange({ country })}
        />
      </Field>
      <Field label="Category">
        <GenreSelect
          store={chart.store}
          value={chart.genre}
          onChange={(genre) => onChange({ genre })}
        />
      </Field>
      {withKind ? (
        <Field label="Chart">
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
        </Field>
      ) : null}
      {chart.store === "APP_STORE" ? (
        <Field label="Device">
          <DeviceSelect />
        </Field>
      ) : null}
      <Field label="Day">
        <ChartDayPicker
          dates={dates}
          value={day}
          onSelect={(date) => onChange({ date })}
        />
      </Field>
      <Field label="Compare">
        <SelectFilter
          title="Compare"
          value={compare}
          options={COMPARE_OPTIONS}
          onChange={(next) => onChange({ compare: next })}
        />
      </Field>
    </div>
  );
}
