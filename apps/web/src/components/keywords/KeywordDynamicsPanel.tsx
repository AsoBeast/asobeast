"use client";

import { Suspense, useCallback, useDeferredValue, useId } from "react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { RangePicker } from "@/components/rankings/RangePicker";
import { RANGE_PRESETS, WIDEST_RANGE } from "@/lib/ranges";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { keywordIdsParser, rangeParser } from "@/lib/search-params";
import { SHOW_DYNAMICS_BUTTON_ID } from "./KeywordsBulkActions";
import { KeywordDynamicsChart } from "./KeywordDynamicsChart";
import { KeywordDynamicsSkeleton } from "./skeletons";

export const DYNAMICS_FOCUS_KEY = "keyword-dynamics-panel";

export function useShowDynamics(): (ids: string[]) => void {
  const [, setChartedKeywords] = useQueryState("keywords", keywordIdsParser);
  return useCallback(
    (ids) => {
      armFocusHandoff(DYNAMICS_FOCUS_KEY);
      void setChartedKeywords(ids);
    },
    [setChartedKeywords],
  );
}

export function KeywordDynamicsPanel({
  id,
  market,
  homeCountry,
}: {
  id: string;
  market: string;
  homeCountry: string;
}) {
  const [selected] = useQueryState("keywords", keywordIdsParser);
  const [range, setRange] = useQueryState("range", rangeParser);
  const [, setKeywords] = useQueryState("keywords", keywordIdsParser);
  const shownRange = useDeferredValue(range);
  const headingId = useId();
  const headingRef = useFocusClaim(DYNAMICS_FOCUS_KEY);

  const clear = () => {
    document.getElementById(SHOW_DYNAMICS_BUTTON_ID)?.focus();
    void setKeywords(null);
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
