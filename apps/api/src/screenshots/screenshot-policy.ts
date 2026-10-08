import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import type { ScreenshotReadingState } from '@asobeast/shared';
import type { Env } from '../config/env';
import { OcrLanguage, ocrLanguagesFor } from './ocr-languages';

export interface ReadListing {
  store: Store;
  country: string;
  localization?: string | null;
}

@Injectable()
export class ScreenshotPolicy {
  constructor(private readonly config: ConfigService<Env, true>) {}

  languagesFor(listing: ReadListing): OcrLanguage[] {
    if (listing.store !== Store.APP_STORE || !this.enabled) return [];
    return ocrLanguagesFor(
      listing.country,
      this.config.get('SCREENSHOT_OCR_LANGUAGES', { infer: true }),
      listing.localization ?? null,
    );
  }

  state(store: Store): ScreenshotReadingState {
    if (store !== Store.APP_STORE) return 'unsupported';
    return this.enabled ? 'on' : 'off';
  }

  private get enabled(): boolean {
    return this.config.get('SCREENSHOT_OCR', { infer: true });
  }
}
