"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewItem } from "@asobeast/shared";
import {
  useAiAllowanceSpent,
  useAiFailureToast,
} from "@/components/ai/ai-allowance";
import { translateReview } from "@/lib/api";
import {
  aiStatusOptions,
  invalidateAiUsage,
  seedReviewTranslation,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  keptTranslation,
  offersTranslation,
  primaryLanguage,
} from "./review-translation";

const subscribe = (notify: () => void) => {
  window.addEventListener("languagechange", notify);
  return () => window.removeEventListener("languagechange", notify);
};

function useViewerLanguage(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => primaryLanguage(navigator.language),
    () => null,
  );
}

export function useReviewTranslation(
  appId: string,
  review: ReviewItem,
  fallback: string | null,
) {
  const viewer = useViewerLanguage();
  const queryClient = useQueryClient();
  const failAi = useAiFailureToast();
  const spent = useAiAllowanceSpent();
  const { data: status } = useQuery(aiStatusOptions);
  const [shown, setShown] = useState(false);
  const translating = useMutation({
    mutationFn: (language: string) =>
      translateReview(appId, review.id, { language }),
    onSuccess: (translation) => {
      seedReviewTranslation(queryClient, appId, review.id, translation);
      setShown(true);
    },
    onError: (error) => failAi(error, "Could not translate the review"),
    onSettled: () => invalidateAiUsage(queryClient),
  });
  const translate = useSingleFlight(translating);
  const kept = keptTranslation(review, viewer);

  return {
    offered:
      kept !== null ||
      (Boolean(status?.configured) &&
        offersTranslation(review, viewer, fallback)),
    translation: shown ? kept : null,
    kept: kept !== null,
    pending: translating.isPending,
    disabled: translating.isPending || (kept === null && spent),
    toggle: () => {
      if (kept) setShown((value) => !value);
      else if (viewer) translate(viewer);
    },
  };
}
