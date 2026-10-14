"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appKeys, firstRunOptions } from "@/lib/queries";
import { rankingsAdvanced, rankingsCollecting } from "./first-run-timeline";

export function useFirstRunDiscovery(appId: string): boolean {
  const queryClient = useQueryClient();
  const { data } = useQuery(firstRunOptions(appId));
  const previous = useRef(data);

  useEffect(() => {
    if (rankingsAdvanced(previous.current, data)) {
      void queryClient.invalidateQueries({
        queryKey: appKeys.competitorSuggestions(appId),
      });
    }
    previous.current = data;
  }, [appId, data, queryClient]);

  return rankingsCollecting(data);
}
