"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CategoryCollection } from "@asobeast/shared";
import { followChart } from "@/lib/api";
import { invalidateChartMutation } from "@/lib/queries";
import { followErrorText } from "./chart-actions";
import type { ChartCategory } from "./chart-follows";
import { categoryTitle } from "./chart-params";

export function useFollowCategory(category: ChartCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kinds: readonly CategoryCollection[]) => {
      for (const collection of kinds) {
        await followChart({ ...category, collection });
      }
    },
    onSuccess: () =>
      toast.success(
        `Following ${categoryTitle(category)}; the daily run captures its charts from tomorrow`,
      ),
    onError: (error) => toast.error(followErrorText(error)),
    onSettled: () => invalidateChartMutation(queryClient),
  });
}
