import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import sharp from 'sharp';
import { StoreRequestError } from './errors';
import { ScreenshotImageSource } from './screenshot-image.source';
import { appleRenditionUrl } from './screenshot-urls';
import { storeDeadlinePassed } from './store-deadline';

export const ICON_RENDITION_WIDTH = 512;
export const MAX_ICON_BYTES = 1024 * 1024;
export const ICON_PIXEL_TOLERANCE = 2;

const ICON_FETCH_TIMEOUT_MS = 5_000;
const MAX_ICON_PIXELS = 4 * 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 8;

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface DecodedIcon {
  width: number;
  height: number;
  pixels: Buffer;
}

@Injectable()
export class IconImageSource {
  private readonly logger = new Logger(IconImageSource.name);
  private readonly cache = new Map<string, { icon: DecodedIcon; at: number }>();

  constructor(private readonly images: ScreenshotImageSource) {}

  async compare(
    before: string | null,
    after: string | null,
  ): Promise<boolean | null> {
    if (before === null || after === null) return null;
    const [left, right] = await Promise.all([
      this.decode(before),
      this.decode(after),
    ]);
    if (!left || !right) return null;
    return this.samePicture(left, right);
  }

  private samePicture(left: DecodedIcon, right: DecodedIcon): boolean {
    if (left.width !== right.width || left.height !== right.height) {
      return false;
    }
    if (left.pixels.length !== right.pixels.length) return false;
    for (let i = 0; i < left.pixels.length; i++) {
      if (Math.abs(left.pixels[i] - right.pixels[i]) > ICON_PIXEL_TOLERANCE) {
        return false;
      }
    }
    return true;
  }

  private async decode(url: string): Promise<DecodedIcon | null> {
    const address = appleRenditionUrl(url, ICON_RENDITION_WIDTH);
    if (address === null) return null;
    const hit = this.cache.get(address);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.icon;
    if (hit) this.cache.delete(address);
    try {
      const icon = await this.download(address);
      this.remember(address, icon);
      return icon;
    } catch (error) {
      if (storeDeadlinePassed()) {
        throw new StoreRequestError(Store.APP_STORE, 'read', reason(error));
      }
      this.logger.warn(
        `the icon pixel comparison of ${address} gave up and the change is recorded: ${reason(error)}`,
      );
      return null;
    }
  }

  private async download(address: string): Promise<DecodedIcon> {
    const bytes = await this.images.read(address, {
      width: ICON_RENDITION_WIDTH,
      maxBytes: MAX_ICON_BYTES,
      timeoutMs: ICON_FETCH_TIMEOUT_MS,
    });
    const { data, info } = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: MAX_ICON_PIXELS,
    })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, pixels: data };
  }

  private remember(address: string, icon: DecodedIcon): void {
    this.cache.set(address, { icon, at: Date.now() });
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
