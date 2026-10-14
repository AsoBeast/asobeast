"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
  KeywordFieldSavePreview,
} from "@asobeast/shared";
import {
  previewLocalizedKeywordField,
  saveLocalizedKeywordField,
} from "@/lib/api";
import {
  savedDescription,
  shouldConfirmSave,
  tracksNewPhrases,
  upsertLocalization,
} from "@/lib/app-localizations";
import { localizationName } from "@/lib/localizations";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { queuedToast } from "@/lib/queued-toast";
import { useSingleFlight } from "@/lib/single-flight";
import { apiErrorMessage } from "./api-error-message";

interface Review {
  plan: KeywordFieldSavePreview;
  text: string;
}

interface SaveVariables extends Review {
  trackIn: string[];
}

export function useKeywordFieldSave(
  id: string,
  item: AppLocalizationItem,
  onSaved: () => void,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const name = localizationName(item.localization);

  const save = useMutation({
    mutationFn: ({ text, trackIn }: SaveVariables) =>
      saveLocalizedKeywordField(id, item.localization, { text, trackIn }),
    onMutate: () => setError(null),
    onSuccess: (result, { plan, trackIn }) => {
      setReview(null);
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
      if (tracksNewPhrases(plan, trackIn)) queuedToast("scoring");
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "Could not save the keyword field")),
  });
  const saveOnce = useSingleFlight(save);

  const check = useMutation({
    mutationFn: (text: string) =>
      previewLocalizedKeywordField(id, item.localization, { text }),
    onMutate: () => setError(null),
    onSuccess: (plan, text) => {
      if (shouldConfirmSave(plan)) {
        setReview({ plan, text });
        return;
      }
      saveOnce({
        plan,
        text,
        trackIn: plan.markets.map((market) => market.country),
      });
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "Could not check the keyword field")),
  });
  const checkOnce = useSingleFlight(check);

  return {
    checking: check.isPending || (review === null && save.isPending),
    saving: save.isPending,
    review: review?.plan ?? null,
    error,
    clearError: () => setError(null),
    request: checkOnce,
    confirm: (trackIn: string[]) => {
      if (review !== null) saveOnce({ ...review, trackIn });
    },
    dismiss: () => {
      setReview(null);
      setError(null);
    },
  };
}
