"use client";

import { Suspense, useCallback, useDeferredValue, useId, useMemo } from "react";
import { useQueryState } from "nuqs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RangePicker } from "@/components/rankings/RangePicker";
import { RANGE_PRESETS, WIDEST_RANGE } from "@/lib/ranges";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { keywordsOptions } from "@/lib/queries";
import {
  keywordChartSelectionParser,
  rangeParser,
  type KeywordChartSelection,
} from "@/lib/search-params";
import { defaultSeed } from "./dynamics-selection";
import { SHOW_DYNAMICS_BUTTON_ID } from "./KeywordsBulkActions";
import { KeywordDynamicsChart } from "./KeywordDynamicsChart";
import { KeywordDynamicsSkeleton } from "./skeletons";

export const DYNAMICS_FOCUS_KEY = "keyword-dynamics-panel";

export function useShowDynamics(): (ids: string[]) => void {
  const [, setChartedKeywords] = useQueryState(
    "keywords",
    keywordChartSelectionParser,
  );
  return useCallback(
    (ids) => {
      armFocusHandoff(DYNAMICS_FOCUS_KEY);
      void setChartedKeywords({ mode: "chart", ids });
    },
    [setChartedKeywords],
  );
}

export function KeywordDynamicsPanel({
  id,
  market,
  homeCountry,
  selection,
}: {
  id: string;
  market: string;
  homeCountry: string;
  selection: KeywordChartSelection;
}) {
  if (selection.mode === "chart") {
    return (
      <KeywordDynamicsCard
        id={id}
        market={market}
        homeCountry={homeCountry}
        selected={selection.ids}
      />
    );
  }
  if (selection.mode === "hidden") return null;
  return <AutoChartedCard id={id} market={market} homeCountry={homeCountry} />;
}

function AutoChartedCard({
  id,
  market,
  homeCountry,
}: {
  id: string;
  market: string;
  homeCountry: string;
}) {
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id, market));
  const seed = useMemo(() => defaultSeed(tracked), [tracked]);
  const selected = useDeferredValue(seed);
  if (tracked.length === 0) return null;
  return (
    <KeywordDynamicsCard
      id={id}
      market={market}
      homeCountry={homeCountry}
      selected={selected}
    />
  );
}

function KeywordDynamicsCard({
  id,
  market,
  homeCountry,
  selected,
}: {
  id: string;
  market: string;
  homeCountry: string;
  selected: readonly string[];
}) {
  const [range, setRange] = useQueryState("range", rangeParser);
  const [, setKeywords] = useQueryState(
    "keywords",
    keywordChartSelectionParser,
  );
  const shownRange = useDeferredValue(range);
  const headingId = useId();
  const headingRef = useFocusClaim(DYNAMICS_FOCUS_KEY);

  const clear = () => {
    document.getElementById(SHOW_DYNAMICS_BUTTON_ID)?.focus();
    void setKeywords({ mode: "hidden" });
    void setRange(null);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="text-body font-medium outline-none"
        >
          Keyword dynamics
        </h3>
        <RangePicker
          presets={RANGE_PRESETS}
          value={range}
          onChange={setRange}
          label="Chart date range"
        />
        <Button variant="ghost" size="sm" className="ml-auto" onClick={clear}>
          Clear
        </Button>
      </div>
      <Suspense fallback={<KeywordDynamicsSkeleton />}>
        <KeywordDynamicsChart
          id={id}
          market={market}
          homeCountry={homeCountry}
          selected={selected}
          range={shownRange}
          onClear={clear}
          onWiden={() => void setRange(WIDEST_RANGE)}
        />
      </Suspense>
    </section>
  );
}
