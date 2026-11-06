import { Prisma } from '@prisma/client';
import { KeywordDiscoveryCount } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

type DiscoveryCountReader = Pick<PrismaService, 'keywordDiscovery'>;

const openDiscoveries = (
  appIds: readonly string[],
  country: string | undefined,
): Prisma.KeywordDiscoveryWhereInput => ({
  OR: appIds.map((appId) => ({
    appId,
    dismissedAt: null,
    keyword: {
      tracked: { none: { appId } },
      ...(country ? { country } : {}),
    },
  })),
});

const countsByApp = async (
  prisma: DiscoveryCountReader,
  where: Prisma.KeywordDiscoveryWhereInput,
): Promise<Map<string, number>> => {
  const rows = await prisma.keywordDiscovery.groupBy({
    by: ['appId'],
    where,
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.appId, row._count._all]));
};

export async function countDiscoveries(
  prisma: DiscoveryCountReader,
  appIds: readonly string[],
  country?: string,
): Promise<Map<string, KeywordDiscoveryCount>> {
  if (appIds.length === 0) return new Map();
  const open = openDiscoveries(appIds, country);
  const [all, ranked] = await Promise.all([
    countsByApp(prisma, open),
    countsByApp(prisma, { AND: [open, { position: { not: null } }] }),
  ]);
  return new Map(
    appIds.map((appId) => [
      appId,
      { open: all.get(appId) ?? 0, ranked: ranked.get(appId) ?? 0 },
    ]),
  );
}
