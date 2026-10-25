import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { appleRenditionUrl } from './screenshot-urls';

export const ICON_RENDITION_WIDTH = 512;
export const ICON_FETCH_TIMEOUT_MS = 5_000;
export const MAX_ICON_BYTES = 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface DecodedIcon {
  width: number;
  height: number;
  pixels: Buffer;
}

@Injectable()
export class IconImageSource {
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
    return (
      left.width === right.width &&
      left.height === right.height &&
      left.pixels.equals(right.pixels)
    );
  }

  private async decode(url: string): Promise<DecodedIcon | null> {
    const address = appleRenditionUrl(url, ICON_RENDITION_WIDTH);
    if (address === null) return null;
    try {
      const response = await fetch(address, {
        signal: AbortSignal.timeout(ICON_FETCH_TIMEOUT_MS),
        redirect: 'manual',
        headers: { accept: IMAGE_TYPES.join(',') },
      });
      if (!response.ok) return null;
      const type = (response.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!IMAGE_TYPES.includes(type)) return null;
      const declared = Number(response.headers.get('content-length') ?? 0);
      if (declared > MAX_ICON_BYTES) return null;
      const body = await this.body(response);
      if (body === null) return null;
      const { data, info } = await sharp(body)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, pixels: data };
    } catch {
      return null;
    }
  }

  private async body(response: Response): Promise<Buffer | null> {
    if (response.body === null) return null;
    const reader: ReadableStreamDefaultReader<Uint8Array> =
      response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, total);
      total += value.byteLength;
      if (total > MAX_ICON_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  }
}
