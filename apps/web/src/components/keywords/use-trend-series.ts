"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { rankingsOptions } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import {
  seriesByKeyword,
  type TrendSeries,
  type TrendState,
  type TrendWindow,
} from "@/lib/trend-window";

export function useTrendSeries({
  appId,
  country,
  trendWindow,
  columnShown,
}: {
  appId: string;
  country: string;
  trendWindow: TrendWindow;
  columnShown: boolean;
}) {
  const hydrated = useHydrated();
  const wanted = trendWindow === "30d" && columnShown;
  const read = useQuery({
    ...rankingsOptions(appId, { country, includePaused: true }),
    enabled: hydrated && wanted,
  });
  const series = useMemo<TrendSeries | undefined>(
    () => (read.data ? seriesByKeyword(read.data.series) : undefined),
    [read.data],
  );
  let state: TrendState = "ready";
  if (wanted && !series) state = read.isError ? "failed" : "pending";
  return { series, state, read };
}
