"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppSetupState, AppSetupUpdateRequest } from "@asobeast/shared";
import { ApiError, updateAppSetup } from "@/lib/api";
import { appKeys, invalidateSetupMutation, setupOptions } from "@/lib/queries";
import { applySetupPatch, type SetupTransition } from "./setup-transitions";

export const SETUP_SAVE_ERROR = "Could not save your setup progress";

export function useSetup(id: string) {
  const client = useQueryClient();
  const queryKey = appKeys.setup(id);
  const { data: setup } = useSuspenseQuery(setupOptions(id));
  const mutation = useMutation({
    mutationKey: queryKey,
    scope: { id: queryKey.join(":") },
    mutationFn: (patch: AppSetupUpdateRequest) => updateAppSetup(id, patch),
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : SETUP_SAVE_ERROR,
      );
    },
    onSettled: () =>
      client.isMutating({ mutationKey: queryKey }) === 1
        ? invalidateSetupMutation(client, id)
        : undefined,
  });

  const apply = (transition: SetupTransition) => {
    const current = client.getQueryData<AppSetupState>(queryKey) ?? setup;
    const patch = transition(current);
    if (!patch) return;
    void client.cancelQueries({ queryKey });
    client.setQueryData(queryKey, applySetupPatch(current, patch, new Date()));
    mutation.mutate(patch);
  };

  return { setup, apply };
}
