import { addUtcDays } from '@asobeast/shared';
import { listingIn } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { utcDay } from './rankings.support';

export async function followedSubtitles(
  prisma: PrismaService,
  apps: readonly { id: string; storeAppId: string; country: string }[],
  market: string,
  shownDay: string,
): Promise<Map<string, string | null>> {
  if (apps.length === 0) return new Map();
  const before = utcDay(addUtcDays(shownDay, 1));
  const snapshots = await prisma.appSnapshot.findMany({
    where: {
      OR: apps.map((app) => ({
        appId: app.id,
        ...listingIn(app.country, market),
        capturedAt: { lt: before },
      })),
    },
    orderBy: { capturedAt: 'desc' },
    distinct: ['appId'],
    select: { appId: true, subtitle: true },
  });
  const storeAppIdOf = new Map(apps.map((app) => [app.id, app.storeAppId]));
  const subtitles = new Map<string, string | null>();
  for (const { appId, subtitle } of snapshots) {
    const storeAppId = storeAppIdOf.get(appId);
    if (storeAppId !== undefined && !subtitles.has(storeAppId)) {
      subtitles.set(storeAppId, subtitle || null);
    }
  }
  return subtitles;
}
