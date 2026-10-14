"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppSetupState, AppSetupUpdateRequest } from "@asobeast/shared";
import { ApiError, updateAppSetup } from "@/lib/api";
import { invalidateSetupMutation, setupKey, setupOptions } from "@/lib/queries";
import { applySetupPatch, type SetupTransition } from "./setup-transitions";

const SETUP_SAVE_ERROR = "Could not save your setup progress";

interface SetupSave {
  patch: AppSetupUpdateRequest;
  previous: AppSetupState;
}

export const setupSaveQueue = (id: string) => ({
  mutationKey: setupKey(id),
  scope: { id: setupKey(id).join(":") },
});

export function toastSetupError(error: unknown): void {
  toast.error(
    error instanceof ApiError ? error.envelope.message : SETUP_SAVE_ERROR,
  );
}

export function useSetup(id: string) {
  const client = useQueryClient();
  const queryKey = setupKey(id);
  const { data: setup } = useSuspenseQuery(setupOptions(id));
  const isLastSave = () => client.isMutating({ mutationKey: queryKey }) === 1;
  const mutation = useMutation({
    ...setupSaveQueue(id),
    mutationFn: ({ patch }: SetupSave) => updateAppSetup(id, patch),
    onError: (error, { previous }) => {
      if (isLastSave()) client.setQueryData(queryKey, previous);
      toastSetupError(error);
    },
    onSettled: () =>
      isLastSave() ? invalidateSetupMutation(client, id) : undefined,
  });

  const apply = (transition: SetupTransition, onSaved?: () => void) => {
    const current = client.getQueryData<AppSetupState>(queryKey) ?? setup;
    const patch = transition(current);
    if (!patch) return;
    void client.cancelQueries({ queryKey });
    client.setQueryData(queryKey, applySetupPatch(current, patch, new Date()));
    mutation.mutate({ patch, previous: current }, { onSuccess: onSaved });
  };

  return { setup, apply };
}
