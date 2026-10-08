import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SnapshotScreenshot } from '@prisma/client';
import { EVERY_LISTING, listingMarket } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenshotFetchError } from '../store-providers/errors';
import { ScreenshotImageSource } from '../store-providers/screenshot-image.source';
import { CaptionChangeRecorder } from './caption-change-recorder';
import { selectCaption } from './caption-text';
import { type PreparedImage, prepareForOcr } from './image-preprocess';
import { OCR_ENGINE, type OcrEngine } from './ocr-engine';
import { type OcrLanguage, ocrRecipe } from './ocr-languages';
import { ScreenshotPolicy } from './screenshot-policy';
import { type CachedText, ScreenshotTextCache } from './screenshot-text-cache';

const isFinalFailure = (error: unknown): boolean =>
  !(error instanceof ScreenshotFetchError) || !error.retryable;

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class ScreenshotReader {
  private readonly logger = new Logger(ScreenshotReader.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ScreenshotPolicy,
    private readonly cache: ScreenshotTextCache,
    private readonly source: ScreenshotImageSource,
    @Inject(OCR_ENGINE) private readonly engine: OcrEngine,
    private readonly captionChanges: CaptionChangeRecorder,
  ) {}

  async read(snapshotId: string): Promise<void> {
    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { id: snapshotId, ...EVERY_LISTING },
      select: {
        id: true,
        appId: true,
        capturedAt: true,
        country: true,
        localization: true,
        app: { select: { store: true, country: true } },
      },
    });
    if (!snapshot) return;

    const listing = {
      home: snapshot.app.country,
      market: listingMarket(snapshot.app.country, snapshot.country),
      localization: snapshot.localization,
    };
    const languages = this.policy.languagesFor({
      store: snapshot.app.store,
      country: listing.market,
      localization: listing.localization,
    });
    if (languages.length === 0) {
      await this.prisma.snapshotScreenshot.updateMany({
        where: { snapshotId, status: 'pending' },
        data: { status: 'skipped' },
      });
      return;
    }
    const recipe = ocrRecipe(languages);
    const pending = await this.prisma.snapshotScreenshot.findMany({
      where: { snapshotId, status: 'pending' },
      orderBy: { position: 'asc' },
    });
    for (const row of pending) {
      await this.readRow(row, languages, recipe);
    }
    await this.captionChanges.record({
      id: snapshot.id,
      appId: snapshot.appId,
      capturedAt: snapshot.capturedAt,
      listing,
    });
  }

  async abandon(snapshotId: string): Promise<void> {
    await this.prisma.snapshotScreenshot.updateMany({
      where: { snapshotId, status: 'pending' },
      data: { status: 'failed' },
    });
  }

  private async readRow(
    row: SnapshotScreenshot,
    languages: OcrLanguage[],
    recipe: string,
  ): Promise<void> {
    const text =
      (await this.cache.find(row.assetKey, recipe)) ??
      (await this.recognize(row, languages, recipe));
    await this.prisma.snapshotScreenshot.update({
      where: {
        snapshotId_position: {
          snapshotId: row.snapshotId,
          position: row.position,
        },
      },
      data:
        text === null
          ? { status: 'failed', readAt: new Date() }
          : {
              status: text.status,
              caption: text.caption,
              recipe,
              readAt: new Date(),
            },
    });
  }

  private async recognize(
    row: SnapshotScreenshot,
    languages: OcrLanguage[],
    recipe: string,
  ): Promise<CachedText | null> {
    const prepared = await this.download(row);
    if (prepared === null) return null;
    const lines = await this.engine.read(prepared.image, languages);
    const caption = selectCaption(lines, prepared.height);
    return this.cache.store({
      assetKey: row.assetKey,
      recipe,
      status: caption === null ? 'blank' : 'read',
      caption,
      engine: this.engine.name,
    });
  }

  private async download(
    row: SnapshotScreenshot,
  ): Promise<PreparedImage | null> {
    try {
      return await prepareForOcr(await this.source.read(row.url));
    } catch (error) {
      if (!isFinalFailure(error)) throw error;
      this.logger.warn(
        `screenshot ${row.position} of snapshot ${row.snapshotId} cannot be read: ${reason(error)}`,
      );
      return null;
    }
  }
}
