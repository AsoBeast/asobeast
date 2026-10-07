import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { OCR_ENGINE } from './ocr-engine';
import { ScreenshotPolicy } from './screenshot-policy';
import { ScreenshotQueue } from './screenshot-queue';
import { ScreenshotReader } from './screenshot-reader';
import { ScreenshotRecorder } from './screenshot-recorder';
import { ScreenshotTextCache } from './screenshot-text-cache';
import { ScreenshotsController } from './screenshots.controller';
import { ScreenshotsService } from './screenshots.service';
import { ScreenshotsWorker } from './screenshots.worker';
import { TesseractOcrEngine } from './tesseract.engine';

@Module({
  imports: [
    StoreProvidersModule,
    BullModule.registerQueue({ name: QUEUES.SCREENSHOTS }),
  ],
  controllers: [ScreenshotsController],
  providers: [
    ScreenshotPolicy,
    ScreenshotRecorder,
    ScreenshotQueue,
    ScreenshotTextCache,
    ScreenshotReader,
    ScreenshotsWorker,
    ScreenshotsService,
    { provide: OCR_ENGINE, useClass: TesseractOcrEngine },
  ],
  exports: [
    ScreenshotPolicy,
    ScreenshotRecorder,
    ScreenshotQueue,
    ScreenshotsService,
  ],
})
export class ScreenshotsModule {}
