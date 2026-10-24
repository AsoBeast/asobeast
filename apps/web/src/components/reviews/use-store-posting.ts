"use client";

import { toast } from "sonner";
import type { ReviewReplyPostResult, Store } from "@asobeast/shared";
import { useSharedFlight } from "@/lib/single-flight";
import { postedToast, WITHDRAWN_TOAST } from "./store-reply-access";

export function useStorePosting({
  store,
  saveIfChanged,
  post,
  withdraw,
}: {
  store: Store;
  saveIfChanged: () => Promise<unknown>;
  post: () => Promise<ReviewReplyPostResult>;
  withdraw: () => Promise<ReviewReplyPostResult>;
}) {
  const postOnce = useSharedFlight(post);
  const withdrawOnce = useSharedFlight(withdraw);

  const publish = () =>
    void saveIfChanged()
      .then(() => postOnce(undefined))
      .then(({ review }) => {
        if (review.reply?.post) {
          toast.success(postedToast(store, review.reply.post));
        }
      })
      .catch(() => null);

  const retract = () =>
    void withdrawOnce(undefined)
      .then(() => toast.success(WITHDRAWN_TOAST))
      .catch(() => null);

  return { publish, retract };
}
