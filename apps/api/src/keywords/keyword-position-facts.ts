import { RANK_MILESTONE_TIERS } from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RetainedPositionFacts {
  bestPosition: number | null;
  daysInTier: number | null;
  latestDate: string;
}

interface RetainedPositionRow {
  keywordId: string;
  bestPosition: number | null;
  daysInTier: number | null;
  latestDate: string;
}

const tierBound = Prisma.raw(
  `CASE ${RANK_MILESTONE_TIERS.map(
    (tier) => `WHEN latest.latest_position <= ${tier} THEN ${tier}`,
  ).join(' ')} END`,
);

export async function retainedPositionFacts(
  prisma: PrismaService,
  appId: string,
  keywordIds: string[],
): Promise<Map<string, RetainedPositionFacts>> {
  if (keywordIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.$queryRaw<RetainedPositionRow[]>`
    WITH ordered AS (
      SELECT r."keywordId" AS kw, r."date", r."position"
      FROM "KeywordRanking" r
      WHERE r."appId" = ${appId}
        AND r."keywordId" IN (${Prisma.join(keywordIds)})
    ),
    latest AS (
      SELECT DISTINCT ON (kw)
        kw, "date" AS latest_date, "position" AS latest_position
      FROM ordered
      ORDER BY kw, "date" DESC
    ),
    flagged AS (
      SELECT o.kw, o."date",
             COALESCE(o."position" <= ${tierBound}, FALSE) AS in_tier
      FROM ordered o
      JOIN latest ON latest.kw = o.kw
    ),
    numbered AS (
      SELECT kw, in_tier, "date",
             ROW_NUMBER() OVER (
               PARTITION BY kw, in_tier ORDER BY "date"
             ) AS rn
      FROM flagged
    ),
    islands AS (
      SELECT kw, in_tier, ("date" - rn::int) AS grp,
             MAX("date") AS last_date, COUNT(*)::int AS days
      FROM numbered
      GROUP BY kw, in_tier, ("date" - rn::int)
    ),
    streak AS (
      SELECT i.kw, i.days
      FROM islands i
      JOIN latest ON latest.kw = i.kw
      WHERE i.in_tier AND i.last_date = latest.latest_date
    )
    SELECT ordered.kw AS "keywordId",
           MIN(ordered."position") AS "bestPosition",
           MAX(streak.days) AS "daysInTier",
           MAX(to_char(latest.latest_date, 'YYYY-MM-DD')) AS "latestDate"
    FROM ordered
    JOIN latest ON latest.kw = ordered.kw
    LEFT JOIN streak ON streak.kw = ordered.kw
    GROUP BY ordered.kw`;
  return new Map(
    rows.map((row) => [
      row.keywordId,
      {
        bestPosition: row.bestPosition,
        daysInTier: row.daysInTier,
        latestDate: row.latestDate,
      },
    ]),
  );
}
