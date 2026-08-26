import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export { DAY_MS } from '../store-providers/result-plausibility';

export function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function appsByStoreAppId(
  prisma: PrismaService,
  store: Store,
  country: string,
  storeAppIds: string[],
): Promise<Map<string, { id: string; isCompetitor: boolean }>> {
  if (storeAppIds.length === 0) {
    return new Map();
  }
  const apps = await prisma.app.findMany({
    where: {
      store,
      country,
      storeAppId: { in: storeAppIds },
    },
    select: { id: true, storeAppId: true, isCompetitor: true },
  });
  return new Map(apps.map((app) => [app.storeAppId, app]));
}
