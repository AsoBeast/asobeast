"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
  AppStoreLocalization,
} from "@asobeast/shared";
import { addAppLocalization } from "@/lib/api";
import { upsertLocalization } from "@/lib/app-localizations";
import { localizationName } from "@/lib/localizations";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { fieldLocaleParser } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";

export function useAddLocalization(
  id: string,
  onAdded?: (item: AppLocalizationItem) => void,
) {
  const queryClient = useQueryClient();
  const [, setFieldLocale] = useQueryState("fieldLocale", fieldLocaleParser);
  const mutation = useMutation({
    mutationFn: (localization: AppStoreLocalization) =>
      addAppLocalization(id, { localization }),
    onSuccess: (item) => {
      queryClient.setQueryData<AppLocalizationsResult>(
        appKeys.localizations(id),
        (current) => current && upsertLocalization(current, item),
      );
      invalidateLocalizationMutation(queryClient, id);
      onAdded?.(item);
      void setFieldLocale(item.localization, { history: "replace" });
      toast.success(`Added ${localizationName(item.localization)}`);
    },
  });
  const add = useSingleFlight(mutation);
  return {
    add,
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
