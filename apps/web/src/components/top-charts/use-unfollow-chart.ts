"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { unfollowChart } from "@/lib/api";
import { forgetChartFollow, invalidateChartMutation } from "@/lib/queries";

export function useUnfollowChart(
  onStopped?: () => void,
  onFailed?: () => void,
) {
  const t = useTranslations("topCharts");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: readonly string[]) => {
      for (const id of ids) await unfollowChart(id);
    },
    onSuccess: (_result, ids) => {
      onStopped?.();
      for (const id of ids) forgetChartFollow(queryClient, id);
      toast.success(t("capture.stopped"));
    },
    onError: () => {
      onFailed?.();
      invalidateChartMutation(queryClient);
      toast.error(t("capture.stopFailed"));
    },
  });
}
