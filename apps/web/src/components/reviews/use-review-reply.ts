"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ReviewItem,
  ReviewReplyItem,
  ReviewReplyPatchRequest,
} from "@asobeast/shared";
import { ApiError, deleteReviewReply, patchReviewReply } from "@/lib/api";
import {
  invalidateReviewReplyMutation,
  upsertReviewReply,
} from "@/lib/queries";
import { useSharedFlight } from "@/lib/single-flight";

const messageOf = (error: Error, fallback: string) =>
  error instanceof ApiError ? error.envelope.message : fallback;

export function useReviewReply(appId: string, review: ReviewItem) {
  const queryClient = useQueryClient();
  const settle = {
    onSuccess: (reply: ReviewReplyItem | null) =>
      upsertReviewReply(queryClient, appId, review, reply),
    onSettled: () => invalidateReviewReplyMutation(queryClient, appId),
  };
  const patching = useMutation({
    mutationFn: (body: ReviewReplyPatchRequest) =>
      patchReviewReply(appId, review.id, body),
    ...settle,
    onSuccess: (reply: ReviewReplyItem, body: ReviewReplyPatchRequest) =>
      settle.onSuccess(body.replied === false && !reply.text ? null : reply),
    onError: (error) =>
      toast.error(messageOf(error, "Could not save the reply")),
  });
  const saving = useMutation({
    mutationFn: (text: string) => patchReviewReply(appId, review.id, { text }),
    ...settle,
    onError: (error) =>
      toast.error(messageOf(error, "Could not save the reply")),
  });
  const discarding = useMutation({
    mutationFn: () => deleteReviewReply(appId, review.id),
    ...settle,
    onSuccess: () => settle.onSuccess(null),
    onError: (error) =>
      toast.error(messageOf(error, "Could not discard the reply")),
  });
  const save = useSharedFlight(saving.mutateAsync);

  return {
    save,
    mark: patching.mutateAsync,
    discard: discarding.mutateAsync,
    pending: patching.isPending || saving.isPending || discarding.isPending,
  };
}
