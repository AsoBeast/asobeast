import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { withTimeout } from '../common/async/with-timeout';
import type { Env } from '../config/env';
import type { OcrLine } from './caption-text';
import type { OcrEngine, OcrThresholding } from './ocr-engine';
import type { OcrLanguage } from './ocr-languages';
import { disposeTessdata, tessdataDirectory } from './tessdata';

export const IDLE_TERMINATE_MS = 5 * 60 * 1000;
export const RECOGNIZE_TIMEOUT_MS = 60_000;

const THRESHOLDING: Record<OcrThresholding, string> = {
  otsu: '0',
  sauvola: '2',
};

@Injectable()
export class TesseractOcrEngine implements OcrEngine, OnModuleDestroy {
  readonly name = 'tesseract.js-7';
  private worker: Worker | null = null;
  private configured = '';
  private idle: NodeJS.Timeout | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  read(
    image: Buffer,
    languages: readonly OcrLanguage[],
    thresholding: OcrThresholding,
  ): Promise<OcrLine[]> {
    const run = this.queue.then(() =>
      this.recognize(image, languages, thresholding),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    this.clearIdle();
    await this.discard();
    await disposeTessdata();
  }

  private async recognize(
    image: Buffer,
    languages: readonly OcrLanguage[],
    thresholding: OcrThresholding,
  ): Promise<OcrLine[]> {
    this.clearIdle();
    try {
      const worker = await this.workerFor(languages, thresholding);
      const { data } = await withTimeout(
        worker.recognize(image, {}, { blocks: true }),
        RECOGNIZE_TIMEOUT_MS,
        `the ocr read took longer than ${RECOGNIZE_TIMEOUT_MS} ms`,
      );
      return (data.blocks ?? [])
        .flatMap((block) => block.paragraphs)
        .flatMap((paragraph) => paragraph.lines)
        .map((line) => ({
          text: line.text,
          confidence: line.confidence,
          left: line.bbox.x0,
          top: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        }));
    } catch (error) {
      await this.discard();
      throw error;
    } finally {
      this.scheduleIdle();
    }
  }

  private async workerFor(
    languages: readonly OcrLanguage[],
    thresholding: OcrThresholding,
  ): Promise<Worker> {
    this.refuseWhileClosing();
    const joined = languages.join('+');
    if (this.worker === null) {
      const enabled = this.config.get('SCREENSHOT_OCR_LANGUAGES', {
        infer: true,
      });
      this.worker = await createWorker([...languages], OEM.LSTM_ONLY, {
        langPath: await tessdataDirectory(enabled),
        gzip: true,
        cacheMethod: 'none',
      });
      this.refuseWhileClosing();
    } else if (this.configured !== joined) {
      await this.worker.reinitialize(joined, OEM.LSTM_ONLY);
    }
    this.configured = joined;
    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      thresholding_method: THRESHOLDING[thresholding],
    });
    return this.worker;
  }

  private refuseWhileClosing(): void {
    if (this.closing) throw new Error('the ocr engine is shutting down');
  }

  private scheduleIdle(): void {
    if (this.closing) return;
    this.idle = setTimeout(() => void this.discard(), IDLE_TERMINATE_MS);
    this.idle.unref();
  }

  private clearIdle(): void {
    if (this.idle !== null) clearTimeout(this.idle);
    this.idle = null;
  }

  private async discard(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    this.configured = '';
    if (worker !== null) await worker.terminate().catch(() => undefined);
  }
}
