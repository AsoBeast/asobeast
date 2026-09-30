import { Prisma } from '@prisma/client';

export function reviewsWrittenInWindow(
  from: Date,
  before?: Date,
): Prisma.ReviewWhereInput {
  const range: Prisma.DateTimeFilter = before
    ? { gte: from, lt: before }
    : { gte: from };
  return {
    OR: [{ reviewedAt: range }, { reviewedAt: null, createdAt: range }],
  };
}
