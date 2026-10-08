import { Injectable } from '@nestjs/common';
import { ScreenshotFetchError } from './errors';
import { appleRenditionUrl } from './screenshot-urls';

export const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024;
export const SCREENSHOT_FETCH_TIMEOUT_MS = 20_000;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const overCap = (bytes: number, verb: string): ScreenshotFetchError =>
  new ScreenshotFetchError(
    `the image ${verb} ${bytes} bytes, over the ${MAX_SCREENSHOT_BYTES} byte cap`,
    false,
  );

@Injectable()
export class ScreenshotImageSource {
  async read(url: string): Promise<Buffer> {
    const rendition = appleRenditionUrl(url);
    if (rendition === null) {
      throw new ScreenshotFetchError(
        `${url} is not an app store image address`,
        false,
      );
    }
    const response = await this.request(rendition);
    this.assertImage(response);
    return this.body(response);
  }

  private async request(rendition: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(rendition, {
        signal: AbortSignal.timeout(SCREENSHOT_FETCH_TIMEOUT_MS),
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

  private assertImage(response: Response): void {
    const type = response.headers.get('content-type') ?? '';
    const mediaType = type.split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.includes(mediaType)) {
      throw new ScreenshotFetchError(
        `the answer is ${type || 'untyped'}`,
        false,
      );
    }
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_SCREENSHOT_BYTES) {
      throw overCap(declared, 'declares');
    }
  }

  private async body(response: Response): Promise<Buffer> {
    if (response.body === null) return Buffer.alloc(0);
    const reader: ReadableStreamDefaultReader<Uint8Array> =
      response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await this.nextChunk(() => reader.read());
      if (done) return Buffer.concat(chunks, total);
      total += value.byteLength;
      if (total > MAX_SCREENSHOT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw overCap(total, 'sent more than');
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
