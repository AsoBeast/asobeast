import { SPACELESS_CHARACTER } from '../common/text/scripts';

export interface OcrLine {
  text: string;
  confidence: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export const MIN_LINE_CONFIDENCE = 70;
export const MIN_SOLID_LETTERS = 3;
export const MIN_SOLID_LETTER_SHARE = 0.6;
export const CAPTION_HEIGHT_RATIO = 0.45;
export const MIN_CAPTION_HEIGHT_SHARE = 0.02;
export const BLOCK_GAP_RATIO = 0.75;
export const BLOCK_MIN_OVERLAP = 0.3;
export const ROW_MIN_OVERLAP = 0.5;
export const ROW_GAP_RATIO = 1;
export const MOCKUP_BAND = [0.2, 0.8] as const;
export const MOCKUP_WEIGHT = 0.35;
export const MIN_SINGLE_LINE_SHARE = 0.03;
export const MAX_CAPTION_CHARS = 400;

const HAS_TEXT = /[\p{L}\p{N}]/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/gu;
const WHITESPACE = /\s/gu;
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

interface Block {
  lines: OcrLine[];
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const bottomOf = (line: OcrLine): number => line.top + line.height;
const rightOf = (line: OcrLine): number => line.left + line.width;

function isSolid(text: string): boolean {
  const letters = text.match(LETTER_OR_DIGIT)?.length ?? 0;
  const visible = text.replace(WHITESPACE, '').length;
  return (
    letters >= MIN_SOLID_LETTERS && letters >= visible * MIN_SOLID_LETTER_SHARE
  );
}

function sameRow(a: OcrLine, b: OcrLine): boolean {
  const overlap = Math.min(bottomOf(a), bottomOf(b)) - Math.max(a.top, b.top);
  return overlap >= ROW_MIN_OVERLAP * Math.min(a.height, b.height);
}

function besideLast(block: Block, line: OcrLine): boolean {
  const last = block.lines[block.lines.length - 1];
  const gap = Math.max(line.left - rightOf(last), last.left - rightOf(line));
  return (
    sameRow(last, line) &&
    gap <= ROW_GAP_RATIO * Math.max(line.height, last.height)
  );
}

function below(block: Block, line: OcrLine): boolean {
  const last = block.lines[block.lines.length - 1];
  const gap = line.top - block.bottom;
  const overlap =
    Math.min(rightOf(line), block.right) - Math.max(line.left, block.left);
  const narrower = Math.min(line.width, block.right - block.left);
  return (
    gap <= BLOCK_GAP_RATIO * Math.max(line.height, last.height) &&
    overlap >= BLOCK_MIN_OVERLAP * narrower
  );
}

const joins = (block: Block, line: OcrLine): boolean =>
  below(block, line) || besideLast(block, line);

function readingOrder(lines: readonly OcrLine[]): OcrLine[] {
  const rows: OcrLine[][] = [];
  for (const line of [...lines].sort((a, b) => a.top - b.top)) {
    const row = rows.find((candidate) => sameRow(candidate[0], line));
    if (row) row.push(line);
    else rows.push([line]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.left - b.left));
}

function groupBlocks(lines: readonly OcrLine[]): Block[] {
  const blocks: Block[] = [];
  const ordered = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  for (const line of ordered) {
    const block = blocks.find((candidate) => joins(candidate, line));
    if (block) {
      block.lines.push(line);
      block.left = Math.min(block.left, line.left);
      block.right = Math.max(block.right, rightOf(line));
      block.bottom = Math.max(block.bottom, bottomOf(line));
    } else {
      blocks.push({
        lines: [line],
        left: line.left,
        top: line.top,
        right: rightOf(line),
        bottom: bottomOf(line),
      });
    }
  }
  return blocks;
}

function weightOf(block: Block, imageHeight: number): number {
  const area = block.lines.reduce(
    (sum, line) => sum + line.width * line.height,
    0,
  );
  const centre = (block.top + block.bottom) / 2 / imageHeight;
  const inMockup = centre > MOCKUP_BAND[0] && centre < MOCKUP_BAND[1];
  return inMockup ? area * MOCKUP_WEIGHT : area;
}

const isLoneTitle = (block: Block, imageHeight: number): boolean =>
  block.lines.length === 1 &&
  block.lines[0].height < imageHeight * MIN_SINGLE_LINE_SHARE;

export function selectCaption(
  lines: readonly OcrLine[],
  imageHeight: number,
): string | null {
  const readable = lines
    .filter((line) => line.confidence >= MIN_LINE_CONFIDENCE)
    .map((line) => ({ ...line, text: clean(line.text) }))
    .filter((line) => HAS_TEXT.test(line.text));
  const solid = readable.filter((line) => isSolid(line.text));
  if (solid.length === 0) return null;

  const tallest = Math.max(...solid.map((line) => line.height));
  const floor = Math.max(
    tallest * CAPTION_HEIGHT_RATIO,
    imageHeight * MIN_CAPTION_HEIGHT_SHARE,
  );
  const [best] = groupBlocks(readable.filter((line) => line.height >= floor))
    .filter(
      (block) =>
        !isLoneTitle(block, imageHeight) &&
        block.lines.some((line) => isSolid(line.text)),
    )
    .map((block) => ({ block, weight: weightOf(block, imageHeight) }))
    .sort((a, b) => b.weight - a.weight);
  if (!best) return null;

  const text = clean(
    readingOrder(best.block.lines)
      .map((line) => line.text)
      .join(' '),
  );
  const caption = Array.from(text).slice(0, MAX_CAPTION_CHARS).join('').trim();
  return caption.length > 0 ? caption : null;
}
