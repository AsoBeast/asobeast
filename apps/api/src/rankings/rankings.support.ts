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

export const utcDay = (date: string) => new Date(`${date}T00:00:00.000Z`);

export interface FollowedApp {
  id: string;
  isCompetitor: boolean;
}

export interface FollowedRecord extends FollowedApp {
  storeAppId: string;
  country: string;
}

function preferenceOf(app: FollowedRecord, country: string): number {
  return (app.country === country ? 0 : 2) + (app.isCompetitor ? 1 : 0);
}

export function followedRecords(
  prisma: PrismaService,
  store: Store,
  storeAppIds: string[],
): Promise<FollowedRecord[]> {
  if (storeAppIds.length === 0) {
    return Promise.resolve([]);
  }
  return prisma.app.findMany({
    where: { store, storeAppId: { in: storeAppIds } },
    select: { id: true, storeAppId: true, country: true, isCompetitor: true },
    orderBy: { id: 'asc' },
  });
}

export async function appsByStoreAppId(
  prisma: PrismaService,
  store: Store,
  country: string,
  storeAppIds: string[],
): Promise<Map<string, FollowedApp>> {
  return preferredRecords(
    await followedRecords(prisma, store, storeAppIds),
    country,
  );
}

export function preferredRecords(
  apps: readonly FollowedRecord[],
  country: string,
): Map<string, FollowedApp> {
  const known = new Map<string, FollowedRecord>();
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
