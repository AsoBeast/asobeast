"use client";

import {
  Suspense,
  useCallback,
  useDeferredValue,
  useId,
  type RefObject,
} from "react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { RangePicker } from "@/components/rankings/RangePicker";
import { RANGE_PRESETS, WIDEST_RANGE } from "@/lib/ranges";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { keywordChartSelectionParser, rangeParser } from "@/lib/search-params";
import type { ChartedSelection } from "./dynamics-selection";
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
  chart,
  clearFocus,
}: {
  id: string;
  market: string;
  homeCountry: string;
  chart: ChartedSelection;
  clearFocus: RefObject<HTMLButtonElement | null>;
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
    const opener = document.getElementById(SHOW_DYNAMICS_BUTTON_ID);
    if (opener) {
      opener.focus();
    } else {
      clearFocus.current?.focus();
    }
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
        <p className="text-caption text-muted-foreground">
          Charted rows are highlighted in the table.
        </p>
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
          chart={chart}
          range={shownRange}
          onClear={clear}
          onWiden={() => void setRange(WIDEST_RANGE)}
        />
      </Suspense>
    </section>
  );
}
