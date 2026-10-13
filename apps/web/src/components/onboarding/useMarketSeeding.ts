"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/components/localizations/api-error-message";
import { seedMarket } from "@/lib/api";
import { invalidateMarketSeed } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  outcomeOf,
  withoutOutcomes,
  type SeedOutcome,
  type SeedPlan,
} from "./market-seeding";

export function useMarketSeeding(
  appId: string,
  onSelect: (market: string, selected: boolean) => void,
) {
  const queryClient = useQueryClient();
  const [outcomes, setOutcomes] = useState<Record<string, SeedOutcome>>({});
  const record = (market: string, outcome: SeedOutcome) =>
    setOutcomes((current) => ({ ...current, [market]: outcome }));
  const mutation = useMutation({
    mutationFn: async ({ select, seed }: SeedPlan) => {
      setOutcomes((current) => withoutOutcomes(current, select));
      for (const market of seed) {
        try {
          const result = await seedMarket(appId, market);
          record(market, outcomeOf(result));
          if (result.status === "unavailable") onSelect(market, false);
        } catch (error) {
          record(market, {
            kind: "failed",
            message: apiErrorMessage(error, "Could not seed this market"),
          });
        }
      }
    },
    onSettled: () => invalidateMarketSeed(queryClient, appId),
  });
  const run = useSingleFlight(mutation);
  return {
    outcomes,
    run,
    seeding: mutation.isPending ? (mutation.variables?.seed ?? []) : [],
  };
}
