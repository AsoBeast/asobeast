import { Injectable } from '@nestjs/common';
import { ScreenshotFetchError } from './errors';
import { appleRenditionUrl } from './screenshot-urls';

export const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024;
export const SCREENSHOT_FETCH_TIMEOUT_MS = 20_000;

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
      throw new ScreenshotFetchError(
        `the image is ${bytes.byteLength} bytes, over the ${MAX_SCREENSHOT_BYTES} byte cap`,
        false,
      );
    }
    return bytes;
  }

  private async request(rendition: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(rendition, {
        signal: AbortSignal.timeout(SCREENSHOT_FETCH_TIMEOUT_MS),
        headers: { accept: 'image/jpeg,image/*;q=0.8' },
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
    if (!type.startsWith('image/')) {
      throw new ScreenshotFetchError(
        `the answer is ${type || 'untyped'}`,
        false,
      );
    }
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_SCREENSHOT_BYTES) {
      throw new ScreenshotFetchError(
        `the image declares ${declared} bytes, over the ${MAX_SCREENSHOT_BYTES} byte cap`,
        false,
      );
    }
  }
}
