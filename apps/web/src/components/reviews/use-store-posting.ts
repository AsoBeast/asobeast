"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { ReviewReplyPostResult, Store } from "@asobeast/shared";
import { useSharedFlight } from "@/lib/single-flight";
import { postedToast } from "./store-reply-access";

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
  const t = useTranslations("reviews");
  const postOnce = useSharedFlight(post);
  const withdrawOnce = useSharedFlight(withdraw);

  const publish = () =>
    void saveIfChanged()
      .then(() => postOnce(undefined))
      .then(({ review }) => {
        if (review.reply?.post) {
          toast.success(postedToast(store, review.reply.post, t));
        }
      })
      .catch(() => null);

  const retract = () =>
    void withdrawOnce(undefined)
      .then(() => toast.success(t("storeAccess.withdrawn")))
      .catch(() => null);

  return { publish, retract };
}
