import type { OcrLine } from './caption-text';
import type { OcrLanguage } from './ocr-languages';

export interface OcrEngine {
  readonly name: string;
  read(image: Buffer, languages: readonly OcrLanguage[]): Promise<OcrLine[]>;
}

export const OCR_ENGINE = Symbol('OCR_ENGINE');
