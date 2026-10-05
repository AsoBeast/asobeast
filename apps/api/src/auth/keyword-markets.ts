import type { Prisma, Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Client = Prisma.TransactionClient | PrismaService;

export interface KeywordMarketRow {
  workspaceId: string;
  store: Store;
  count: number;
}

export async function countKeywordMarkets(client: Client): Promise<number> {
  const [row] = await client.$queryRaw<{ markets: bigint }[]>`
    SELECT COUNT(DISTINCT "keywordId") AS markets
    FROM "TrackedKeyword"
    WHERE "active" = true
  `;
  return Number(row?.markets ?? 0);
}

export function keywordMarketsByWorkspace(
  client: Client,
): Promise<KeywordMarketRow[]> {
  return client.$queryRaw<KeywordMarketRow[]>`
    SELECT a."workspaceId", k."store", COUNT(DISTINCT t."keywordId")::int AS count
    FROM "TrackedKeyword" t
    JOIN "App" a ON a."id" = t."appId"
    JOIN "Keyword" k ON k."id" = t."keywordId"
    WHERE t."active" = true
    GROUP BY 1, 2
  `;
}

export function sumKeywordMarkets(rows: readonly KeywordMarketRow[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}
