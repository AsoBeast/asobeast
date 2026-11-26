"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
  KeywordFieldSavePreview,
} from "@asobeast/shared";
import {
  previewLocalizedKeywordField,
  saveLocalizedKeywordField,
  apiErrorMessage,
} from "@/lib/api";
import {
  savedDescription,
  shouldConfirmSave,
  tracksNewPhrases,
  upsertLocalization,
} from "@/lib/app-localizations";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { queuedToast } from "@/lib/queued-toast";
import { useSingleFlight } from "@/lib/single-flight";

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
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const name = localizationNameInLocale(item.localization, locale);

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
      toast.success(t("editor.saved", { name }), {
        description: savedDescription(result, t, locale),
      });
      if (tracksNewPhrases(plan, trackIn)) queuedToast("scoring");
    },
    onError: (err) => setError(apiErrorMessage(err, t("editor.saveFailed"))),
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
    onError: (err) => setError(apiErrorMessage(err, t("editor.checkFailed"))),
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
