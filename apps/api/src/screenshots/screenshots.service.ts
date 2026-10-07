import { Injectable, NotFoundException } from '@nestjs/common';
import type { SnapshotScreenshot } from '@prisma/client';
import type {
  AppScreenshots,
  ScreenshotCaptionStatus,
  ScreenshotItem,
} from '@asobeast/shared';
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

  latest(appId: string) {
    return this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        capturedAt: true,
        screenshots: { orderBy: { position: 'asc' } },
      },
    });
  }
}
