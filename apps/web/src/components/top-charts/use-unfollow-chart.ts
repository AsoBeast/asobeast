"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { unfollowChart } from "@/lib/api";
import { invalidateChartMutation } from "@/lib/queries";

export function useUnfollowChart(onStopped?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unfollowChart(id),
    onSuccess: () => {
      onStopped?.();
      invalidateChartMutation(queryClient);
      toast.success("Stopped following");
    },
    onError: () => toast.error("Could not stop following the chart."),
  });
}
