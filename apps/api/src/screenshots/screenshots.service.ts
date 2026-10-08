import { Injectable, NotFoundException } from '@nestjs/common';
import type { SnapshotScreenshot } from '@prisma/client';
import type { Store } from '@prisma/client';
import { assertStorefront } from '@asobeast/shared';
import type {
  AppScreenshots,
  ScreenshotCaptionStatus,
  ScreenshotItem,
  ScreenshotReadingState,
} from '@asobeast/shared';
import { listingIn, NEWEST_FIRST } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotPolicy } from './screenshot-policy';

const toItem = (row: SnapshotScreenshot): ScreenshotItem => ({
  position: row.position,
  url: row.url,
  caption: row.caption,
  status: row.status as ScreenshotCaptionStatus,
});

@Injectable()
export class ScreenshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ScreenshotPolicy,
  ) {}

  async forApp(appId: string, country?: string): Promise<AppScreenshots> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, country: true },
    });
    if (!app) throw new NotFoundException(`App ${appId} not found`);
    const market = country ?? app.country;
    const home = market === app.country;
    if (!home) assertStorefront(app.store, market);
    const latest = await this.latest(appId, app.country, market);
    if (!latest && !home) {
      throw new NotFoundException(`No listing captured for ${market}`);
    }
    return {
      appId,
      store: app.store,
      snapshotId: latest?.id ?? null,
      capturedAt: latest?.capturedAt.toISOString() ?? null,
      reading: this.reading(app.store),
      screenshots: (latest?.screenshots ?? []).map(toItem),
      country: market,
    };
  }

  reading(store: Store): ScreenshotReadingState {
    return this.policy.state(store);
  }

  async ofSnapshots(
    store: Store,
    snapshotIds: readonly string[],
  ): Promise<Map<string, ScreenshotItem[]>> {
    const screenshots = new Map<string, ScreenshotItem[]>();
    if (this.reading(store) === 'unsupported' || snapshotIds.length === 0) {
      return screenshots;
    }
    const rows = await this.prisma.snapshotScreenshot.findMany({
      where: { snapshotId: { in: [...snapshotIds] } },
      orderBy: { position: 'asc' },
    });
    for (const row of rows) {
      screenshots.set(row.snapshotId, [
        ...(screenshots.get(row.snapshotId) ?? []),
        toItem(row),
      ]);
    }
    return screenshots;
  }

  private latest(appId: string, home: string, market: string) {
    return this.prisma.appSnapshot.findFirst({
      where: { appId, ...listingIn(home, market) },
      orderBy: NEWEST_FIRST,
      select: {
        id: true,
        capturedAt: true,
        screenshots: { orderBy: { position: 'asc' } },
      },
    });
  }
}
