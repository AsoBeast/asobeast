import { PrismaService } from '../prisma/prisma.service';

export async function bestPositions(
  prisma: PrismaService,
  appId: string,
  keywordIds: string[],
): Promise<Map<string, number | null>> {
  if (keywordIds.length === 0) {
    return new Map();
  }
  const grouped = await prisma.keywordRanking.groupBy({
    by: ['keywordId'],
    where: { appId, keywordId: { in: keywordIds }, position: { not: null } },
    _min: { position: true },
  });
  return new Map(
    grouped.map((row) => [row.keywordId, row._min.position ?? null]),
  );
}
