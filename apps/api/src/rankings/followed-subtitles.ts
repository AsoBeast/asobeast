import { addUtcDays } from '@asobeast/shared';
import { listingIn } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { utcDay } from './rankings.support';

export async function followedSubtitles(
  prisma: PrismaService,
  apps: readonly { id: string; country: string }[],
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
  return new Map(
    snapshots.map((snapshot) => [snapshot.appId, snapshot.subtitle || null]),
  );
}
