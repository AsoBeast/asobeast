"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { rankingsOptions } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { seriesByKeyword, type TrendWindow } from "@/lib/trend-window";

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
  const { data } = useQuery({
    ...rankingsOptions(appId, { country }),
    enabled: hydrated && trendWindow === "30d" && columnShown,
  });
  return useMemo(
    () => (data ? seriesByKeyword(data.series) : undefined),
    [data],
  );
}
