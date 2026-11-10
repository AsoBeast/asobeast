"use client";

import { Suspense, useDeferredValue, type ReactNode } from "react";
import { useQueryState } from "nuqs";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { CardContent } from "@/components/ui/card";
import { RangePicker } from "@/components/rankings/RangePicker";
import { ShareOfVoiceHelp } from "@/components/visibility/ShareOfVoiceHelp";
import { VisibilityHelp } from "@/components/visibility/VisibilityHelp";
import { VISIBILITY_RANGES, type VisibilityRange } from "@/lib/ranges";
import {
  visibilityRangeParser,
  type VisibilityView,
} from "@/lib/search-params";
import { RankBandsChart } from "./RankBandsChart";
import { OVERVIEW_VIEW_TITLES } from "./use-overview-view";
import { ShareOfVoiceChart } from "./ShareOfVoiceChart";
import { VisibilityAreaChart } from "./VisibilityAreaChart";

interface ChartView {
  help?: ReactNode;
  Chart: (props: { id: string; range: VisibilityRange }) => ReactNode;
}

const OVERVIEW_CHARTS: Record<VisibilityView, ChartView> = {
  visibility: {
    help: <VisibilityHelp />,
    Chart: VisibilityAreaChart,
  },
  share: {
    help: <ShareOfVoiceHelp />,
    Chart: ShareOfVoiceChart,
  },
  top10: {
    Chart: RankBandsChart,
  },
};

export function OverviewChart({
  id,
  view,
}: {
  id: string;
  view: VisibilityView;
}) {
  const { country, switchable } = useKeywordScope(id);
  const [range, setRange] = useQueryState("range", visibilityRangeParser);
  const shownRange = useDeferredValue(range);
  const shownView = useDeferredValue(view);
  const { help, Chart } = OVERVIEW_CHARTS[shownView];
  const title = OVERVIEW_VIEW_TITLES[shownView];
  const scope = switchable
    ? ` · ${country?.toUpperCase() ?? "All markets"}`
    : "";

  return (
    <CardContent
      aria-busy={shownView !== view || shownRange !== range || undefined}
      className="flex flex-col gap-2 border-t border-border pt-3 pb-4"
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 text-label font-medium text-muted-foreground">
          <h2>{`${title}${scope}`}</h2>
          {help}
        </div>
        <RangePicker
          presets={VISIBILITY_RANGES}
          value={range}
          onChange={setRange}
        />
      </div>
      <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.tall} />}>
        <Chart id={id} range={shownRange} />
      </Suspense>
    </CardContent>
  );
}
