import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { once } from 'node:events';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { withTimeout } from '../common/async/with-timeout';
import type { Env } from '../config/env';
import type { OcrLine } from './caption-text';
import type { OcrEngine, OcrThresholding } from './ocr-engine';
import type { OcrLanguage } from './ocr-languages';
import type { OcrReply, OcrRequest } from './ocr-thread';
import { disposeTessdata, tessdataDirectory } from './tessdata';

export const IDLE_TERMINATE_MS = 5 * 60 * 1000;
export const RECOGNIZE_TIMEOUT_MS = 60_000;

const THREAD_FILE = join(__dirname, `ocr-thread${extname(__filename)}`);

@Injectable()
export class TesseractOcrEngine implements OcrEngine, OnModuleDestroy {
  readonly name = 'tesseract.js-7';
  private readonly logger = new Logger(TesseractOcrEngine.name);
  private thread: Worker | null = null;
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
      this.refuseWhileClosing();
      const langPath = await tessdataDirectory(
        this.config.get('SCREENSHOT_OCR_LANGUAGES', { infer: true }),
      );
      this.refuseWhileClosing();
      return await withTimeout(
        this.ask({ image, languages: [...languages], thresholding, langPath }),
        RECOGNIZE_TIMEOUT_MS,
        `the ocr read took longer than ${RECOGNIZE_TIMEOUT_MS} ms`,
      );
    } catch (error) {
      await this.discard();
      throw error;
    } finally {
      this.scheduleIdle();
    }
  }

  private async ask(request: OcrRequest): Promise<OcrLine[]> {
    const thread = this.threadOrSpawn();
    const settled = new AbortController();
    const { signal } = settled;
    const replied = Promise.race([
      once(thread, 'message', { signal }),
      once(thread, 'exit', { signal }).then(([code]: unknown[]) => {
        throw new Error(`the ocr thread exited with code ${String(code)}`);
      }),
    ]);
    thread.postMessage(request);
    try {
      const [reply] = (await replied) as [OcrReply];
      if ('error' in reply) throw new Error(reply.error);
      return reply.lines;
    } finally {
      settled.abort();
    }
  }

  private threadOrSpawn(): Worker {
    if (this.thread !== null) return this.thread;
    const thread = new Worker(THREAD_FILE);
    thread.on('error', (error: Error) =>
      this.logger.warn(`the ocr thread failed: ${error.message}`),
    );
    thread.once('exit', () => {
      if (this.thread === thread) this.thread = null;
    });
    this.thread = thread;
    return thread;
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
    const thread = this.thread;
    this.thread = null;
    if (thread !== null) await thread.terminate().catch(() => undefined);
  }
}
