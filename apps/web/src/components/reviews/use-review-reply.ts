"use client";

import { useCallback, useRef } from "react";
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

interface QueuedSave {
  text: string;
  pending: Promise<ReviewReplyItem>;
}

const failWith = (fallback: string) => (error: Error) =>
  toast.error(error instanceof ApiError ? error.envelope.message : fallback);

const removedBy = (body: ReviewReplyPatchRequest, reply: ReviewReplyItem) =>
  body.replied === false && !reply.text;

export function useReviewReply(appId: string, review: ReviewItem) {
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
    onError: failWith("Could not save the reply"),
  });
  const patching = useMutation({
    mutationFn: async (body: ReviewReplyPatchRequest) => {
      await lastSave.current;
      return patchReviewReply(appId, review.id, body);
    },
    onSuccess: (reply, body) => seed(removedBy(body, reply) ? null : reply),
    onSettled,
    onError: failWith("Could not save the reply"),
  });
  const discarding = useMutation({
    mutationFn: async () => {
      await lastSave.current;
      return deleteReviewReply(appId, review.id);
    },
    onSuccess: () => seed(null),
    onSettled,
    onError: failWith("Could not discard the reply"),
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
    pending: patching.isPending || discarding.isPending,
  };
}
