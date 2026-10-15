import { Prisma } from '@prisma/client';
import { ReviewReplyState, ReviewSort } from '@asobeast/shared';

const NEWEST_FIRST: Prisma.ReviewOrderByWithRelationInput[] = [
  { reviewedAt: { sort: 'desc', nulls: 'last' } },
  { id: 'desc' },
];

export type RepliedAtRef = Prisma.FieldRef<'Review', 'DateTime'>;

const replyStateWheres = (
  repliedAt: RepliedAtRef,
): Record<ReviewReplyState, Prisma.ReviewWhereInput> => ({
  updated: { repliedAt: { not: null }, reviewedAt: { gt: repliedAt } },
  replied: {
    OR: [
      {
        repliedAt: { not: null },
        OR: [{ reviewedAt: null }, { reviewedAt: { lte: repliedAt } }],
      },
      { repliedAt: null, reply: { is: { repliedAt: { not: null } } } },
    ],
  },
  drafted: { repliedAt: null, reply: { is: { repliedAt: null } } },
  needs_reply: { repliedAt: null, reply: { is: null } },
});

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
  state: ReviewReplyState | undefined,
  repliedAt: RepliedAtRef,
): Prisma.ReviewWhereInput {
  return state ? replyStateWheres(repliedAt)[state] : {};
}

export function reviewOrder(
  sort: ReviewSort,
): Prisma.ReviewOrderByWithRelationInput[] {
  return sort === 'lowest' ? [{ score: 'asc' }, ...NEWEST_FIRST] : NEWEST_FIRST;
}
