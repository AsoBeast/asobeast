"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
} from "@asobeast/shared";
import { saveLocalizedKeywordField } from "@/lib/api";
import { savedDescription, upsertLocalization } from "@/lib/app-localizations";
import { localizationName } from "@/lib/localizations";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { apiErrorMessage } from "./api-error-message";

export function useKeywordFieldSave(
  id: string,
  item: AppLocalizationItem,
  onSaved: () => void,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const name = localizationName(item.localization);

  const mutation = useMutation({
    mutationFn: (text: string) =>
      saveLocalizedKeywordField(id, item.localization, {
        text,
        trackIn: item.readBy.map((reader) => reader.country),
      }),
    onSuccess: (result) => {
      setError(null);
      queryClient.setQueryData<AppLocalizationsResult>(
        appKeys.localizations(id),
        (current) =>
          current && upsertLocalization(current, result.localization),
      );
      invalidateLocalizationMutation(queryClient, id);
      onSaved();
      toast.success(`Saved the ${name} keyword field`, {
        description: savedDescription(result),
      });
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "Could not save the keyword field")),
  });

  return {
    pending: mutation.isPending,
    error,
    clearError: () => setError(null),
    save: useSingleFlight(mutation),
  };
}
