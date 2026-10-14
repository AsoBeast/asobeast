"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, updateAppSetup } from "@/lib/api";
import { invalidateSetupMutation } from "@/lib/queries";
import { SETUP_SAVE_ERROR } from "./use-setup";

export function useSetupDismissal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (appId: string) =>
      updateAppSetup(appId, { status: "dismissed" }),
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : SETUP_SAVE_ERROR,
      );
    },
    onSettled: (_data, _error, appId) => invalidateSetupMutation(client, appId),
  });
}
