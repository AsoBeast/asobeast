import { Prisma } from '@prisma/client';
import { addUtcDays, utcDayOf } from '@asobeast/shared';
import { DayHistory, REVIEW_SPIKE_BASELINE_DAYS } from './review-spike';

interface DayRow {
  day: Date;
  count: number;
  low: number;
}

const startOf = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

export async function readDayHistory(
  tx: Prisma.TransactionClient,
  appId: string,
  day: string,
  lowScoreMax: number,
): Promise<DayHistory> {
  const from = startOf(addUtcDays(day, -REVIEW_SPIKE_BASELINE_DAYS));
  const to = startOf(addUtcDays(day, 1));
  const oldest = await tx.review.aggregate({
    where: { appId },
    _min: { reviewedAt: true },
  });
  const rows = await tx.$queryRaw<DayRow[]>`
    SELECT "reviewedAt"::date AS day,
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE "score" <= ${lowScoreMax})::int AS low
    FROM "Review"
    WHERE "appId" = ${appId} AND "reviewedAt" >= ${from} AND "reviewedAt" < ${to}
    GROUP BY 1
  `;
  const oldestAt = oldest._min.reviewedAt;
  return {
    counts: new Map(
      rows.map((row) => [
        utcDayOf(row.day),
        { count: row.count, low: row.low },
      ]),
    ),
    oldestDay: oldestAt ? utcDayOf(oldestAt) : null,
  };
}
