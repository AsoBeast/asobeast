import type { Prisma, ReviewReply } from '@prisma/client';
import {
  REVIEW_POST_STATES,
  REVIEW_REPLY_TONES,
  ReviewPostState,
  ReviewReplyItem,
  ReviewReplyPost,
  ReviewReplyTone,
} from '@asobeast/shared';

export const WITH_POSTER = {
  postedBy: { select: { email: true } },
} satisfies Prisma.ReviewReplyInclude;

export type ReviewReplyRow = ReviewReply & {
  postedBy?: { email: string } | null;
};

const isReviewReplyTone = (tone: string | null): tone is ReviewReplyTone =>
  (REVIEW_REPLY_TONES as readonly (string | null)[]).includes(tone);

const isPostState = (state: string | null): state is ReviewPostState =>
  (REVIEW_POST_STATES as readonly (string | null)[]).includes(state);

function postOf(reply: ReviewReplyRow): ReviewReplyPost | null {
  if (!reply.postedAt || reply.postedText === null) return null;
  return {
    postedAt: reply.postedAt.toISOString(),
    postedText: reply.postedText,
    state: isPostState(reply.postState) ? reply.postState : 'pending',
    storeResponseId: reply.storeResponseId,
    postedBy: reply.postedBy?.email ?? null,
  };
}

export function toReviewReplyItem(reply: ReviewReplyRow): ReviewReplyItem {
  return {
    text: reply.text,
    tone: isReviewReplyTone(reply.tone) ? reply.tone : null,
    model: reply.model,
    generatedAt: reply.generatedAt?.toISOString() ?? null,
    updatedAt: reply.updatedAt.toISOString(),
    repliedAt: reply.repliedAt?.toISOString() ?? null,
    post: postOf(reply),
  };
}
