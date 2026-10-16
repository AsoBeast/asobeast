import { Prisma } from '@prisma/client';
import type { FunnelRow } from './discovery-report';
import { countryOfTerritory } from './territory-codes';

export const FUNNEL_UPSERT_BATCH = 500;

const dateValue = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

function valuesOf(
  workspaceId: string,
  appId: string,
  row: FunnelRow,
): Prisma.Sql {
  return Prisma.sql`(gen_random_uuid()::text, ${workspaceId}, ${appId}, ${dateValue(row.date)}::date, ${row.territory}, ${countryOfTerritory(row.territory)}, ${row.sourceType}, ${row.pageType}, ${row.impressions}, ${row.uniqueImpressions}, ${row.pageViews}, ${row.uniquePageViews}, ${row.gets}, ${row.uniqueGets}, ${dateValue(row.processingDate)}::date)`;
}

export function funnelUpserts(
  workspaceId: string,
  appId: string,
  rows: FunnelRow[],
): Prisma.Sql[] {
  const batches: Prisma.Sql[] = [];
  for (let start = 0; start < rows.length; start += FUNNEL_UPSERT_BATCH) {
    const values = rows
      .slice(start, start + FUNNEL_UPSERT_BATCH)
      .map((row) => valuesOf(workspaceId, appId, row));
    batches.push(Prisma.sql`
      INSERT INTO "StoreFunnelDay" ("id", "workspaceId", "appId", "date", "territory", "country", "sourceType", "pageType", "impressions", "uniqueImpressions", "pageViews", "uniquePageViews", "gets", "uniqueGets", "processingDate")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("appId", "date", "territory", "sourceType", "pageType") DO UPDATE SET
        "country" = EXCLUDED."country",
        "impressions" = EXCLUDED."impressions",
        "uniqueImpressions" = EXCLUDED."uniqueImpressions",
        "pageViews" = EXCLUDED."pageViews",
        "uniquePageViews" = EXCLUDED."uniquePageViews",
        "gets" = EXCLUDED."gets",
        "uniqueGets" = EXCLUDED."uniqueGets",
        "processingDate" = EXCLUDED."processingDate"
      WHERE "StoreFunnelDay"."processingDate" <= EXCLUDED."processingDate"`);
  }
  return batches;
}

export function unresolvedTerritories(rows: FunnelRow[]): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.territory)
        .filter((territory) => countryOfTerritory(territory) === null),
    ),
  ];
}
