"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { invalidatePortfolio, runStatusOptions } from "@/lib/queries";
import { unfinishedSince } from "./history-trend";

export function useRefreshAfterRun(): void {
  const { data: run } = useSuspenseQuery(runStatusOptions);
  const queryClient = useQueryClient();
  const unfinished = unfinishedSince(run) !== null;
  const wasUnfinished = useRef(unfinished);

  useEffect(() => {
    if (wasUnfinished.current && !unfinished) invalidatePortfolio(queryClient);
    wasUnfinished.current = unfinished;
  }, [unfinished, queryClient]);
}
