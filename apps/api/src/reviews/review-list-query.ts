import { Prisma } from '@prisma/client';
import { ReviewReplyState, ReviewSort } from '@asobeast/shared';

const NEWEST_FIRST: Prisma.ReviewOrderByWithRelationInput[] = [
  { reviewedAt: { sort: 'desc', nulls: 'last' } },
  { id: 'desc' },
];

const REPLY_STATE_WHERE: Record<ReviewReplyState, Prisma.ReviewWhereInput> = {
  replied: {
    OR: [
      { repliedAt: { not: null } },
      { reply: { is: { repliedAt: { not: null } } } },
    ],
  },
  drafted: { repliedAt: null, reply: { is: { repliedAt: null } } },
  needs_reply: { repliedAt: null, reply: { is: null } },
};

export interface ReviewScope {
  score?: number;
  version?: string;
  from?: Date;
}

export function reviewScopeWhere(
  appId: string,
  { score, version, from }: ReviewScope,
): Prisma.ReviewWhereInput {
  return {
    appId,
    ...(score !== undefined ? { score } : {}),
    ...(version !== undefined ? { version } : {}),
    ...(from !== undefined ? { reviewedAt: { gte: from } } : {}),
  };
}

export function replyStateWhere(
  state?: ReviewReplyState,
): Prisma.ReviewWhereInput {
  return state ? REPLY_STATE_WHERE[state] : {};
}

export function reviewOrder(
  sort: ReviewSort,
): Prisma.ReviewOrderByWithRelationInput[] {
  return sort === 'lowest' ? [{ score: 'asc' }, ...NEWEST_FIRST] : NEWEST_FIRST;
}
