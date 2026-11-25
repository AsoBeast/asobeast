export type Measure = (text: string) => number;

const ELLIPSIS = "…";

export function clipText(
  text: string,
  maxWidth: number,
  measure: Measure,
): string {
  if (measure(text) <= maxWidth) return text;
  const characters = Array.from(text);
  while (
    characters.length > 0 &&
    measure(`${characters.join("")}${ELLIPSIS}`) > maxWidth
  ) {
    characters.pop();
  }
  return `${characters.join("")}${ELLIPSIS}`;
}

export function wrapWords(
  text: string,
  maxWidth: number,
  measure: Measure,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  return line === "" ? lines : [...lines, line];
}

export interface LineBox {
  width: number;
  lines: number;
}

export interface LineFit {
  lines: string[];
  cut: boolean;
  cutAt: number;
  shownWords: string[];
  cutWord: string;
}

interface Span {
  text: string;
  start: number;
  end: number;
}

const codePoints = (text: string): number => Array.from(text).length;

function wordSpans(text: string): Span[] {
  let start = 0;
  return text.split(" ").map((word) => {
    const span = { text: word, start, end: start + codePoints(word) };
    start = span.end + 1;
    return span;
  });
}

function breakWord(word: Span, width: number, measure: Measure): Span[] {
  const pieces: Span[] = [];
  let piece = { text: "", start: word.start, end: word.start };
  for (const character of Array.from(word.text)) {
    if (piece.text !== "" && measure(`${piece.text}${character}`) > width) {
      pieces.push(piece);
      piece = { text: "", start: piece.end, end: piece.end };
    }
    piece = { ...piece, text: `${piece.text}${character}`, end: piece.end + 1 };
  }
  return [...pieces, piece];
}

function wrapSpans(words: Span[], width: number, measure: Measure): Span[] {
  const lines: Span[] = [];
  let line: Span | null = null;
  for (const word of words) {
    if (line) {
      const joined: string = `${line.text} ${word.text}`;
      if (measure(joined) <= width) {
        line = { text: joined, start: line.start, end: word.end };
        continue;
      }
      lines.push(line);
    }
    const pieces =
      measure(word.text) <= width ? [word] : breakWord(word, width, measure);
    lines.push(...pieces.slice(0, -1));
    line = pieces.at(-1) ?? null;
  }
  return line ? [...lines, line] : lines;
}

function endWithEllipsis(line: Span, width: number, measure: Measure): Span {
  const clipped = clipText(`${line.text}${ELLIPSIS}`, width, measure);
  const shown = clipped.slice(0, -ELLIPSIS.length).trimEnd();
  return {
    text: shown,
    start: line.start,
    end: line.start + codePoints(shown),
  };
}

function shownOf(words: Span[], cutAt: number) {
  const broken = words.find((word) => word.start < cutAt && word.end > cutAt);
  return {
    shownWords: words
      .filter((word) => word.end <= cutAt)
      .map((word) => word.text),
    cutWord: broken
      ? Array.from(broken.text)
          .slice(0, cutAt - broken.start)
          .join("")
      : "",
  };
}

export function fitLines(
  text: string,
  box: LineBox,
  measure: Measure,
): LineFit {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized === "") {
    return { lines: [], cut: false, cutAt: 0, shownWords: [], cutWord: "" };
  }
  const words = wordSpans(normalized);
  const wrapped = wrapSpans(words, box.width, measure);
  const shownCount = Math.max(box.lines, 1);
  const lastShown = wrapped[shownCount - 1];
  if (wrapped.length <= box.lines || !lastShown) {
    const cutAt = codePoints(normalized);
    return {
      lines: wrapped.map((line) => line.text),
      cut: false,
      cutAt,
      ...shownOf(words, cutAt),
    };
  }
  const last = endWithEllipsis(lastShown, box.width, measure);
  return {
    lines: [
      ...wrapped.slice(0, shownCount - 1).map((line) => line.text),
      `${last.text}${ELLIPSIS}`,
    ],
    cut: true,
    cutAt: last.end,
    ...shownOf(words, last.end),
  };
}
