"use client";

import { STORES, type Store } from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { storeLabel } from "@/lib/format";
import { useIsMobile } from "@/lib/use-is-mobile";
import { CapturedDayPicker } from "@/components/day-picker/CapturedDayPicker";
import {
  ChartCompareFilter,
  ChartCountryFilter,
  ChartDeviceFilter,
  ChartGenreFilter,
  ChartKindFilter,
  ChartLayoutFilter,
  type ChartFilterProps,
} from "./chart-filter-controls";
import { activeFilterCount } from "./chart-filters";
import { ChartFiltersSheet } from "./ChartFiltersSheet";
import { storeChanged } from "./chart-params";

export function ChartToolbar(
  props: ChartFilterProps & { day: string | null; dates: readonly string[] },
) {
  const { day, dates, ...filters } = props;
  const { chart, compare, onChange } = filters;
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      {isMobile ? null : (
        <>
          <ChartCountryFilter {...filters} />
          <ChartGenreFilter {...filters} />
          <ChartKindFilter {...filters} />
          <ChartDeviceFilter {...filters} />
        </>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <CapturedDayPicker
          dates={dates}
          value={day}
          onSelect={(date) => onChange({ date })}
        />
        {isMobile ? (
          <ChartFiltersSheet
            {...filters}
            active={activeFilterCount(chart, compare)}
          />
        ) : (
          <>
            <ChartCompareFilter {...filters} />
            <ChartLayoutFilter {...filters} />
          </>
        )}
      </div>
    </div>
  );
}
