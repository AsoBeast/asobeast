import { Injectable, NotFoundException } from '@nestjs/common';
import type { SnapshotScreenshot } from '@prisma/client';
import type { Store } from '@prisma/client';
import type {
  AppScreenshots,
  ScreenshotCaptionStatus,
  ScreenshotItem,
  ScreenshotReadingState,
} from '@asobeast/shared';
import { HOME_LISTING, listingIn, NEWEST_FIRST } from '../apps/listing';
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

  async forApp(appId: string): Promise<AppScreenshots> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true },
    });
    if (!app) throw new NotFoundException(`App ${appId} not found`);
    const latest = await this.latest(appId);
    return {
      appId,
      store: app.store,
      snapshotId: latest?.id ?? null,
      capturedAt: latest?.capturedAt.toISOString() ?? null,
      reading: this.policy.state(app.store),
      screenshots: (latest?.screenshots ?? []).map(toItem),
    };
  }

  async byListing(
    app: { id: string; store: Store; country: string },
    markets: readonly string[],
  ): Promise<{
    reading: ScreenshotReadingState;
    screenshots: Map<string, ScreenshotItem[]>;
  }> {
    const found = await Promise.all(
      [...new Set(markets)].map(async (market) => {
        const latest = await this.prisma.appSnapshot.findFirst({
          where: { appId: app.id, ...listingIn(app.country, market) },
          orderBy: NEWEST_FIRST,
          select: { screenshots: { orderBy: { position: 'asc' } } },
        });
        return [market, (latest?.screenshots ?? []).map(toItem)] as const;
      }),
    );
    return {
      reading: this.policy.state(app.store),
      screenshots: new Map(found),
    };
  }

  latest(appId: string) {
    return this.prisma.appSnapshot.findFirst({
      where: { appId, ...HOME_LISTING },
      orderBy: NEWEST_FIRST,
      select: {
        id: true,
        capturedAt: true,
        screenshots: { orderBy: { position: 'asc' } },
      },
    });
  }
}
