"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAppSetup } from "@/lib/api";
import { invalidateSetupMutation } from "@/lib/queries";
import { setupSaveQueue, toastSetupError } from "./use-setup";

export function useSetupDismissal(appId: string) {
  const client = useQueryClient();
  return useMutation({
    ...setupSaveQueue(appId),
    mutationFn: () => updateAppSetup(appId, { status: "dismissed" }),
    onError: toastSetupError,
    onSettled: () => invalidateSetupMutation(client, appId),
  });
}
