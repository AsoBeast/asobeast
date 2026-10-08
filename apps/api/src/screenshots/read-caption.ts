import { type OcrLine, selectCaption } from './caption-text';
import type { PreparedImage } from './image-preprocess';
import type { OcrEngine } from './ocr-engine';
import { mergeOverlapping } from './ocr-merge';
import type { OcrLanguage } from './ocr-languages';

export async function readCaption(
  engine: OcrEngine,
  prepared: PreparedImage,
  languages: readonly OcrLanguage[],
): Promise<string | null> {
  const passes: OcrLine[][] = [];
  for (const pass of prepared.passes) {
    passes.push(await engine.read(pass.image, languages, pass.thresholding));
  }
  return selectCaption(mergeOverlapping(passes), prepared.height);
}
