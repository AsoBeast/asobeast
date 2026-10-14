"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/components/localizations/api-error-message";
import { addCompetitor } from "@/lib/api";
import { invalidateCompetitorMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export type AddOutcome =
  { kind: "added" } | { kind: "failed"; message: string };

export function useAddCompetitors(
  appId: string,
  onAdded: (storeAppIds: string[]) => void,
) {
  const queryClient = useQueryClient();
  const [outcomes, setOutcomes] = useState<Record<string, AddOutcome>>({});
  const record = (storeAppId: string, outcome: AddOutcome) =>
    setOutcomes((current) => ({ ...current, [storeAppId]: outcome }));
  const mutation = useMutation({
    mutationFn: async (storeAppIds: string[]) => {
      const added: string[] = [];
      for (const storeAppId of storeAppIds) {
        try {
          await addCompetitor(appId, storeAppId);
          added.push(storeAppId);
          record(storeAppId, { kind: "added" });
        } catch (error) {
          record(storeAppId, {
            kind: "failed",
            message: apiErrorMessage(error, "Could not add this competitor"),
          });
        }
      }
      return added;
    },
    onSuccess: onAdded,
    onSettled: () => invalidateCompetitorMutation(queryClient, appId),
  });
  return {
    outcomes,
    run: useSingleFlight(mutation),
    adding: mutation.isPending,
  };
}
