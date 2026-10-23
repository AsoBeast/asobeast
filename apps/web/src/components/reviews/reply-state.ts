import {
  isPostEdited,
  REVIEW_REPLY_STATES,
  replyStateOf,
  type ReviewReplyCounts,
  type ReviewReplyState,
  type Store,
} from "@asobeast/shared";
import { storeLabel } from "@/lib/format";

const STATE_LABELS: Record<ReviewReplyState, string> = {
  needs_reply: "Needs reply",
  drafted: "Draft saved",
  replied: "Replied",
  updated: "Updated after reply",
};

const STATE_VARIANTS = {
  needs_reply: "outline",
  drafted: "secondary",
  replied: "success",
  updated: "warning",
} as const satisfies Record<ReviewReplyState, string>;

export const REPLY_STATES_GUIDE =
  "https://docs.asobeast.com/guides/reviews#reply-to-reviews";

export function replyStateLabel(state: ReviewReplyState): string {
  return STATE_LABELS[state];
}

export function replyStateVariant(
  state: ReviewReplyState,
): (typeof STATE_VARIANTS)[ReviewReplyState] {
  return STATE_VARIANTS[state];
}

export function replyBadgeLabel(
  review: Parameters<typeof replyStateOf>[0],
  store: Store,
): string {
  const state = replyStateOf(review);
  if (state !== "replied") return replyStateLabel(state);
  const { reply } = review;
  if (reply?.post) {
    if (isPostEdited(reply)) return "Edited since posting";
    return reply.post.state === "pending" ? "Pending publication" : "Posted";
  }
  return review.repliedAt
    ? `Replied on ${storeLabel(store)}`
    : "Marked replied";
}

export const REPLY_STATE_OPTIONS = REVIEW_REPLY_STATES.map((state) => ({
  value: state,
  label: replyStateLabel(state),
}));

export function shownReplyStates(
  counts: ReviewReplyCounts | undefined,
  selected: ReviewReplyState | null,
) {
  return REPLY_STATE_OPTIONS.filter(
    ({ value }) =>
      value !== "updated" || value === selected || (counts?.updated ?? 0) > 0,
  );
}
