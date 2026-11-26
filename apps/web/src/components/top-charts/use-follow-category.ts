"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { CategoryCollection } from "@asobeast/shared";
import { followChart } from "@/lib/api";
import { invalidateChartMutation } from "@/lib/queries";
import { followErrorText } from "./chart-actions";
import type { ChartCategory } from "./chart-follows";
import { categoryTitle } from "./chart-params";
import { useAppLocale } from "@/lib/use-app-locale";

export function useFollowCategory(category: ChartCategory) {
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kinds: readonly CategoryCollection[]) => {
      for (const collection of kinds) {
        await followChart({ ...category, collection });
      }
    },
    onSuccess: () =>
      toast.success(
        t("capture.followSuccess", {
          category: categoryTitle(category, locale),
        }),
      ),
    onError: (error) => toast.error(followErrorText(error, t)),
    onSettled: () => invalidateChartMutation(queryClient),
  });
}
