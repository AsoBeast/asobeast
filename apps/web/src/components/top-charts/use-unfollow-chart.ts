"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { unfollowChart } from "@/lib/api";
import { forgetChartFollow, invalidateChartMutation } from "@/lib/queries";

export function useUnfollowChart(
  onStopped?: () => void,
  onFailed?: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: readonly string[]) => {
      for (const id of ids) await unfollowChart(id);
    },
    onSuccess: (_result, ids) => {
      onStopped?.();
      for (const id of ids) forgetChartFollow(queryClient, id);
      toast.success("Stopped following");
    },
    onError: () => {
      onFailed?.();
      invalidateChartMutation(queryClient);
      toast.error("Could not stop following the category.");
    },
  });
}
