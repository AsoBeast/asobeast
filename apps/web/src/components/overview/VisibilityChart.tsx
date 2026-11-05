"use client";

import { Suspense, useDeferredValue } from "react";
import { useQueryState } from "nuqs";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RangePicker } from "@/components/rankings/RangePicker";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { VISIBILITY_RANGES } from "@/lib/ranges";
import {
  visibilityRangeParser,
  visibilityViewParser,
  type VisibilityView,
} from "@/lib/search-params";
import { ShareOfVoiceChart } from "./ShareOfVoiceChart";
import { VisibilityAreaChart } from "./VisibilityAreaChart";

const VIEW_TITLES: Record<VisibilityView, string> = {
  visibility: "Search visibility over time",
  share: "Share of voice over time",
};

export function VisibilityChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", visibilityRangeParser);
  const shownRange = useDeferredValue(range);
  const [view, setView] = useQueryState("visView", visibilityViewParser);
  const shownView = useDeferredValue(view);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Visibility history</CardDescription>
        <CardTitle>{VIEW_TITLES[shownView]}</CardTitle>
        <CardAction className="flex flex-wrap items-center justify-end gap-2">
          <Tabs
            value={view}
            onValueChange={(next) => void setView(next as VisibilityView)}
          >
            <TabsList aria-label="Chart view" className="print:hidden">
              <TabsOption value="visibility">Visibility</TabsOption>
              <TabsOption value="share">Share of voice</TabsOption>
            </TabsList>
          </Tabs>
          <RangePicker
            presets={VISIBILITY_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.compact} />}>
          {shownView === "share" ? (
            <ShareOfVoiceChart id={id} range={shownRange} />
          ) : (
            <VisibilityAreaChart id={id} range={shownRange} />
          )}
        </Suspense>
      </CardContent>
    </Card>
  );
}
