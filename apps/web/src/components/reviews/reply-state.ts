import {
  isPostEdited,
  REVIEW_REPLY_STATES,
  replyStateOf,
  type ReviewReplyCounts,
  type ReviewReplyState,
  type Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

const STATE_VARIANTS = {
  needs_reply: "outline",
  drafted: "secondary",
  replied: "success",
  updated: "warning",
} as const satisfies Record<ReviewReplyState, string>;

export const REPLY_STATES_GUIDE =
  "https://docs.asobeast.com/guides/reviews#reply-to-reviews";

export function replyStateLabel(
  state: ReviewReplyState,
  t: MessageTranslator = english,
): string {
  return t(`state.${state}`);
}

export function replyStateVariant(
  state: ReviewReplyState,
): (typeof STATE_VARIANTS)[ReviewReplyState] {
  return STATE_VARIANTS[state];
}

export function replyBadgeLabel(
  review: Parameters<typeof replyStateOf>[0],
  store: Store,
  t: MessageTranslator = english,
): string {
  const state = replyStateOf(review);
  if (state !== "replied") return replyStateLabel(state, t);
  const { reply } = review;
  if (reply?.post) {
    if (isPostEdited(reply)) return t("state.edited");
    return reply.post.state === "pending"
      ? t("state.pending")
      : t("state.posted");
  }
  return review.repliedAt
    ? t("state.repliedOn", { store: storeLabel(store) })
    : t("state.marked");
}

export function replyBadgeVariant(
  review: Parameters<typeof replyStateOf>[0],
): ReturnType<typeof replyStateVariant> | "info" {
  const { reply } = review;
  if (reply?.post && replyStateOf(review) === "replied") {
    if (isPostEdited(reply)) return "warning";
    if (reply.post.state === "pending") return "info";
  }
  return replyStateVariant(replyStateOf(review));
}

export function shownReplyStates(
  counts: ReviewReplyCounts | undefined,
  selected: ReviewReplyState | null,
  t: MessageTranslator = english,
) {
  return REVIEW_REPLY_STATES.map((state) => ({
    value: state,
    short: t(`state.short.${state}`),
  })).filter(
    ({ value }) =>
      value !== "updated" || value === selected || (counts?.updated ?? 0) > 0,
  );
}
