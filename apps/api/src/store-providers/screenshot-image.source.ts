import { Injectable } from '@nestjs/common';
import { ScreenshotFetchError } from './errors';
import { appleRenditionUrl } from './screenshot-urls';
import { storeDeadline } from './store-deadline';

export const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024;
export const SCREENSHOT_FETCH_TIMEOUT_MS = 20_000;

export interface ImageReadOptions {
  width?: number;
  maxBytes?: number;
  timeoutMs?: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const overCap = (
  bytes: number,
  verb: string,
  maxBytes: number,
): ScreenshotFetchError =>
  new ScreenshotFetchError(
    `the image ${verb} ${bytes} bytes, over the ${maxBytes} byte cap`,
    false,
  );

@Injectable()
export class ScreenshotImageSource {
  async read(url: string, options: ImageReadOptions = {}): Promise<Buffer> {
    const maxBytes = options.maxBytes ?? MAX_SCREENSHOT_BYTES;
    const rendition = appleRenditionUrl(url, options.width);
    if (rendition === null) {
      throw new ScreenshotFetchError(
        `${url} is not an app store image address`,
        false,
      );
    }
    const response = await this.request(rendition, options.timeoutMs);
    this.assertImage(response, maxBytes);
    return this.body(response, maxBytes);
  }

  private async request(
    rendition: string,
    timeoutMs = SCREENSHOT_FETCH_TIMEOUT_MS,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(rendition, {
        signal: this.signal(timeoutMs),
        redirect: 'manual',
        headers: { accept: IMAGE_TYPES.join(',') },
      });
    } catch (error) {
      throw new ScreenshotFetchError(
        `the image request failed: ${reason(error)}`,
        true,
      );
    }
    if (!response.ok) {
      throw new ScreenshotFetchError(
        `the image request answered ${response.status}`,
        isRetryableStatus(response.status),
      );
    }
    return response;
  }

  private signal(timeoutMs: number): AbortSignal {
    const timeout = AbortSignal.timeout(timeoutMs);
    const deadline = storeDeadline().signal;
    return deadline ? AbortSignal.any([timeout, deadline]) : timeout;
  }

  private assertImage(response: Response, maxBytes: number): void {
    const type = response.headers.get('content-type') ?? '';
    const mediaType = type.split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.includes(mediaType)) {
      throw new ScreenshotFetchError(
        `the answer is ${type || 'untyped'}`,
        false,
      );
    }
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > maxBytes) {
      throw overCap(declared, 'declares', maxBytes);
    }
  }

  private async body(response: Response, maxBytes: number): Promise<Buffer> {
    if (response.body === null) return Buffer.alloc(0);
    const reader: ReadableStreamDefaultReader<Uint8Array> =
      response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await this.nextChunk(() => reader.read());
      if (done) return Buffer.concat(chunks, total);
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw overCap(total, 'sent more than', maxBytes);
      }
      chunks.push(value);
    }
  }

  private async nextChunk<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      throw new ScreenshotFetchError(
        `the image download failed: ${reason(error)}`,
        true,
      );
    }
  }
}
