import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import type { ScreenshotReadingState } from '@asobeast/shared';
import type { Env } from '../config/env';
import { OcrLanguage, ocrLanguagesFor } from './ocr-languages';

@Injectable()
export class ScreenshotPolicy {
  constructor(private readonly config: ConfigService<Env, true>) {}

  languagesFor(app: { store: Store; country: string }): OcrLanguage[] {
    if (app.store !== Store.APP_STORE || !this.enabled) return [];
    return ocrLanguagesFor(
      app.country,
      this.config.get('SCREENSHOT_OCR_LANGUAGES', { infer: true }),
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
