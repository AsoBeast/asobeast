import { ReviewReply } from '@prisma/client';
import {
  REVIEW_REPLY_TONES,
  ReviewReplyItem,
  ReviewReplyTone,
} from '@asobeast/shared';

const isReviewReplyTone = (tone: string | null): tone is ReviewReplyTone =>
  (REVIEW_REPLY_TONES as readonly (string | null)[]).includes(tone);

export function toReviewReplyItem(reply: ReviewReply): ReviewReplyItem {
  return {
    text: reply.text,
    tone: isReviewReplyTone(reply.tone) ? reply.tone : null,
    model: reply.model,
    generatedAt: reply.generatedAt?.toISOString() ?? null,
    updatedAt: reply.updatedAt.toISOString(),
    repliedAt: reply.repliedAt?.toISOString() ?? null,
  };
}
