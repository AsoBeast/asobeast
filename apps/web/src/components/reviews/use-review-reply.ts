"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  ReviewItem,
  ReviewReplyItem,
  ReviewReplyPatchRequest,
  ReviewReplyPostResult,
} from "@asobeast/shared";
import {
  ApiError,
  deleteReviewReply,
  patchReviewReply,
  postReviewReply,
  withdrawReviewReply,
} from "@/lib/api";
import {
  invalidateReviewReplyMutation,
  invalidateReviewReplyPost,
  replaceReview,
  upsertReviewReply,
} from "@/lib/queries";

interface QueuedSave {
  text: string;
  pending: Promise<ReviewReplyItem>;
}

const failWith = (fallback: string) => (error: Error) =>
  toast.error(error instanceof ApiError ? error.envelope.message : fallback);

const removedBy = (body: ReviewReplyPatchRequest, reply: ReviewReplyItem) =>
  body.replied === false && !reply.text;

export function useReviewReply(appId: string, review: ReviewItem) {
  const t = useTranslations("reviews");
  const queryClient = useQueryClient();
  const lastSave = useRef<Promise<unknown>>(Promise.resolve());
  const lastQueued = useRef<QueuedSave | null>(null);
  const seed = (reply: ReviewReplyItem | null) =>
    upsertReviewReply(queryClient, appId, review, reply);
  const onSettled = () => invalidateReviewReplyMutation(queryClient, appId);

  const saving = useMutation({
    mutationFn: (text: string) => patchReviewReply(appId, review.id, { text }),
    onSuccess: seed,
    onSettled,
    onError: failWith(t("composer.saveFailed")),
  });
  const patching = useMutation({
    mutationFn: async (body: ReviewReplyPatchRequest) => {
      await lastSave.current;
      return patchReviewReply(appId, review.id, body);
    },
    onSuccess: (reply, body) => seed(removedBy(body, reply) ? null : reply),
    onSettled,
    onError: failWith(t("composer.saveFailed")),
  });
  const replace = ({ review: next }: ReviewReplyPostResult) =>
    replaceReview(queryClient, appId, next, review);
  const onStoreSettled = () => invalidateReviewReplyPost(queryClient, appId);
  const posting = useMutation({
    mutationFn: async () => {
      await lastSave.current;
      return postReviewReply(appId, review.id);
    },
    onSuccess: replace,
    onSettled: onStoreSettled,
    onError: failWith(t("composer.postFailed")),
  });
  const withdrawing = useMutation({
    mutationFn: () => withdrawReviewReply(appId, review.id),
    onSuccess: replace,
    onSettled: onStoreSettled,
    onError: failWith(t("composer.withdrawFailed")),
  });
  const discarding = useMutation({
    mutationFn: async () => {
      await lastSave.current;
      return deleteReviewReply(appId, review.id);
    },
    onSuccess: () => seed(null),
    onSettled,
    onError: failWith(t("composer.discardFailed")),
  });
  const save = useCallback(
    (text: string) => {
      const queued = lastQueued.current;
      if (queued?.text === text) return queued.pending;
      const pending = lastSave.current.then(() => saving.mutateAsync(text));
      const entry = { text, pending };
      lastQueued.current = entry;
      lastSave.current = pending.catch(() => null);
      void lastSave.current.then(() => {
        if (lastQueued.current === entry) lastQueued.current = null;
      });
      return pending;
    },
    [saving.mutateAsync],
  );

  return {
    save,
    mark: patching.mutateAsync,
    discard: discarding.mutateAsync,
    post: posting.mutateAsync,
    withdraw: withdrawing.mutateAsync,
    pending:
      patching.isPending ||
      discarding.isPending ||
      posting.isPending ||
      withdrawing.isPending,
  };
}
