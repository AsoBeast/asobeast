import {
  REVIEW_REPLY_STATES,
  replyStateOf,
  type ReviewItem,
  type ReviewReplyState,
} from "@asobeast/shared";

const STATE_LABELS: Record<ReviewReplyState, string> = {
  needs_reply: "Needs reply",
  drafted: "Draft saved",
  replied: "Replied",
};

const STATE_VARIANTS = {
  needs_reply: "outline",
  drafted: "secondary",
  replied: "success",
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
  review: Pick<ReviewItem, "repliedAt" | "reply">,
): string {
  const state = replyStateOf(review);
  if (state !== "replied") return STATE_LABELS[state];
  return review.repliedAt ? "Replied on Google Play" : "Marked replied";
}

export const REPLY_STATE_OPTIONS = REVIEW_REPLY_STATES.map((state) => ({
  value: state,
  label: STATE_LABELS[state],
}));
