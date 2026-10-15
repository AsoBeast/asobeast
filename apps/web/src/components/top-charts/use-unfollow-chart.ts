"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { unfollowChart } from "@/lib/api";
import { forgetChartFollow } from "@/lib/queries";

export function useUnfollowChart(onStopped?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unfollowChart(id),
    onSuccess: (_result, id) => {
      onStopped?.();
      forgetChartFollow(queryClient, id);
      toast.success("Stopped following");
    },
    onError: () => toast.error("Could not stop following the chart."),
  });
}
