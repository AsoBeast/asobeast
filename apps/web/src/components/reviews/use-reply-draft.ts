"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReviewItem, ReviewReplyDraftRequest } from "@asobeast/shared";
import { useAiFailureToast } from "@/components/ai/ai-allowance";
import { draftReviewReply } from "@/lib/api";
import {
  invalidateAiUsage,
  invalidateReviewReplyMutation,
  upsertReviewReply,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export function useReplyDraft(
  appId: string,
  review: ReviewItem,
  onDraft: (text: string) => void,
) {
  const queryClient = useQueryClient();
  const failAi = useAiFailureToast();
  const drafting = useMutation({
    mutationFn: (request: ReviewReplyDraftRequest) =>
      draftReviewReply(appId, review.id, request),
    onSuccess: (result) => {
      upsertReviewReply(queryClient, appId, review, result.reply);
      onDraft(result.reply.text);
    },
    onError: (error) => failAi(error, "Could not draft a reply"),
    onSettled: () => {
      invalidateAiUsage(queryClient);
      invalidateReviewReplyMutation(queryClient, appId);
    },
  });

  return {
    draft: useSingleFlight(drafting),
    drafting: drafting.isPending,
    result: drafting.data,
  };
}

export type ReplyDraft = ReturnType<typeof useReplyDraft>;
