"use client";

import type { RefObject } from "react";
import type { Store } from "@asobeast/shared";
import { ChartImageButtons } from "@/components/charts/ChartImageButtons";
import { buildChartCaption } from "@/lib/chart-image/caption";
import { chartImageFilename } from "@/lib/chart-image/filename";
import { appDetailOptions } from "@/lib/queries";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

export function MapImageButtons({
  chartRef,
  appId,
  store,
  market,
  today,
}: {
  chartRef: RefObject<HTMLDivElement | null>;
  appId: string;
  store: Store;
  market: string;
  today: string;
}) {
  const detail = useCachedQueryData(appDetailOptions(appId).queryKey);
  const makeJob = () => {
    const container = chartRef.current;
    if (!container) return null;
    const appName = detail?.name ?? null;
    return {
      container,
      filename: chartImageFilename({
        chart: "opportunity-map",
        appName,
        appId,
        from: today,
        to: today,
      }),
      caption: buildChartCaption({
        title: "Keyword opportunity map",
        appName,
        storeAppId: detail?.storeAppId ?? appId,
        store,
        countries: [market],
        from: today,
        to: today,
        series: [],
      }),
    };
  };
  return <ChartImageButtons subject="the opportunity map" makeJob={makeJob} />;
}
