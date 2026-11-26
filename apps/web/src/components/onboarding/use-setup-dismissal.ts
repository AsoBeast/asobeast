"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { updateAppSetup } from "@/lib/api";
import { invalidateSetupMutation } from "@/lib/queries";
import { setupSaveQueue, toastSetupError } from "./use-setup";

export function useSetupDismissal(appId: string) {
  const t = useTranslations("setup");
  const client = useQueryClient();
  return useMutation({
    ...setupSaveQueue(appId),
    mutationFn: () => updateAppSetup(appId, { status: "dismissed" }),
    onError: (error) => toastSetupError(error, t),
    onSettled: () => invalidateSetupMutation(client, appId),
  });
}
