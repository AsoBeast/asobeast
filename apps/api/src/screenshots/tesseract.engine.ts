import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { Env } from '../config/env';
import type { OcrLine } from './caption-text';
import type { OcrEngine } from './ocr-engine';
import type { OcrLanguage } from './ocr-languages';
import { disposeTessdata, tessdataDirectory } from './tessdata';

export const IDLE_TERMINATE_MS = 5 * 60 * 1000;

@Injectable()
export class TesseractOcrEngine implements OcrEngine, OnModuleDestroy {
  readonly name = 'tesseract.js-7';
  private worker: Worker | null = null;
  private languages = '';
  private idle: NodeJS.Timeout | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService<Env, true>) {}

  read(image: Buffer, languages: readonly OcrLanguage[]): Promise<OcrLine[]> {
    const run = this.queue.then(() => this.recognize(image, languages));
    this.queue = run.catch(() => undefined);
    return run;
  }

  async onModuleDestroy(): Promise<void> {
    this.clearIdle();
    await this.discard();
    await disposeTessdata();
  }

  private async recognize(
    image: Buffer,
    languages: readonly OcrLanguage[],
  ): Promise<OcrLine[]> {
    this.clearIdle();
    try {
      const worker = await this.workerFor(languages);
      const { data } = await worker.recognize(image, {}, { blocks: true });
      return (data.blocks ?? [])
        .flatMap((block) => block.paragraphs)
        .flatMap((paragraph) => paragraph.lines)
        .map((line) => ({
          text: line.text,
          confidence: line.confidence,
          top: line.bbox.y0,
          height: line.bbox.y1 - line.bbox.y0,
        }));
    } catch (error) {
      await this.discard();
      throw error;
    } finally {
      this.idle = setTimeout(() => void this.discard(), IDLE_TERMINATE_MS);
      this.idle.unref();
    }
  }

  private async workerFor(languages: readonly OcrLanguage[]): Promise<Worker> {
    const key = languages.join('+');
    if (this.worker === null) {
      const enabled = this.config.get('SCREENSHOT_OCR_LANGUAGES', {
        infer: true,
      });
      this.worker = await createWorker([...languages], OEM.LSTM_ONLY, {
        langPath: await tessdataDirectory(enabled),
        gzip: true,
        cacheMethod: 'none',
      });
    } else if (this.languages !== key) {
      await this.worker.reinitialize(key, OEM.LSTM_ONLY);
    }
    this.languages = key;
    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
    return this.worker;
  }

  private clearIdle(): void {
    if (this.idle !== null) clearTimeout(this.idle);
    this.idle = null;
  }

  private async discard(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    this.languages = '';
    if (worker !== null) await worker.terminate().catch(() => undefined);
  }
}
