import { Injectable } from '@nestjs/common';
import { AiContentPart, AiRequestError } from '../../ai/openai.client';
import { ScreenshotFetchError } from '../../store-providers/errors';
import {
  DownloadedImage,
  ScreenshotImageSource,
} from '../../store-providers/screenshot-image.source';
import { isStoreImageUrl } from '../../store-providers/screenshot-urls';

export const LISTING_IMAGE_UNAVAILABLE =
  'A listing image could not be downloaded from the store. Refresh the app, then try again.';

const dataUrl = ({ bytes, mediaType }: DownloadedImage): string =>
  `data:${mediaType};base64,${bytes.toString('base64')}`;

@Injectable()
export class CreativeImages {
  constructor(private readonly images: ScreenshotImageSource) {}

  inline(parts: AiContentPart[]): Promise<AiContentPart[]> {
    return Promise.all(parts.map((part) => this.inlined(part)));
  }

  private async inlined(part: AiContentPart): Promise<AiContentPart> {
    if (part.type !== 'image' || !isStoreImageUrl(part.url)) return part;
    try {
      return { ...part, url: dataUrl(await this.images.readListed(part.url)) };
    } catch (error) {
      throw error instanceof ScreenshotFetchError
        ? new AiRequestError(LISTING_IMAGE_UNAVAILABLE, error.retryable)
        : error;
    }
  }
}
