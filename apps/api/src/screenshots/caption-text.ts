import { SPACELESS_CHARACTER } from '../common/text/scripts';

export interface OcrLine {
  text: string;
  confidence: number;
  top: number;
  height: number;
}

export const MIN_LINE_CONFIDENCE = 60;
export const CAPTION_HEIGHT_RATIO = 0.55;
export const MIN_CAPTION_HEIGHT_SHARE = 0.02;
export const MAX_CAPTION_CHARS = 400;

const HAS_TEXT = /[\p{L}\p{N}]/u;
const EDGE_NOISE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}.!?)\]'"%]+$/gu;

export function joinSpacelessRuns(text: string): string {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  return words.reduce((joined, word) => {
    if (joined.length === 0) return word;
    const glue =
      SPACELESS_CHARACTER.test(joined.slice(-1)) &&
      SPACELESS_CHARACTER.test(word.charAt(0));
    return glue ? `${joined}${word}` : `${joined} ${word}`;
  }, '');
}

const clean = (text: string): string =>
  joinSpacelessRuns(text).replace(EDGE_NOISE, '').trim();

export function selectCaption(
  lines: readonly OcrLine[],
  imageHeight: number,
): string | null {
  const readable = lines
    .filter((line) => line.confidence >= MIN_LINE_CONFIDENCE)
    .map((line) => ({ ...line, text: clean(line.text) }))
    .filter((line) => HAS_TEXT.test(line.text));
  if (readable.length === 0) return null;

  const tallest = Math.max(...readable.map((line) => line.height));
  const floor = Math.max(
    tallest * CAPTION_HEIGHT_RATIO,
    imageHeight * MIN_CAPTION_HEIGHT_SHARE,
  );
  const kept = readable
    .filter((line) => line.height >= floor)
    .sort((a, b) => a.top - b.top);
  if (kept.length === 0) return null;

  return Array.from(kept.map((line) => line.text).join(' '))
    .slice(0, MAX_CAPTION_CHARS)
    .join('')
    .trim();
}
