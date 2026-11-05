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
import { VISIBILITY_RANGES } from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";
import { VisibilityAreaChart } from "./VisibilityAreaChart";

export function VisibilityChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", visibilityRangeParser);
  const shownRange = useDeferredValue(range);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Visibility history</CardDescription>
        <CardTitle>Search visibility over time</CardTitle>
        <CardAction>
          <RangePicker
            presets={VISIBILITY_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.compact} />}>
          <VisibilityAreaChart id={id} range={shownRange} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
