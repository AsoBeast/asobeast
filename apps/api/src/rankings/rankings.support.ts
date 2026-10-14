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

interface KnownApp {
  id: string;
  storeAppId: string;
  country: string;
  isCompetitor: boolean;
}

function preferenceOf(app: KnownApp, country: string): number {
  return (app.country === country ? 0 : 2) + (app.isCompetitor ? 1 : 0);
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
    where: { store, storeAppId: { in: storeAppIds } },
    select: { id: true, storeAppId: true, country: true, isCompetitor: true },
    orderBy: { id: 'asc' },
  });
  const known = new Map<string, KnownApp>();
  for (const app of apps) {
    const held = known.get(app.storeAppId);
    if (!held || preferenceOf(app, country) < preferenceOf(held, country)) {
      known.set(app.storeAppId, app);
    }
  }
  return new Map(
    [...known].map(([storeAppId, app]) => [
      storeAppId,
      { id: app.id, isCompetitor: app.isCompetitor },
    ]),
  );
}
