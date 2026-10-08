import { normalizeText } from '@asobeast/shared';

export const CAPTION_SIMILARITY = 0.85;

function distance(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  left.forEach((letter, row) => {
    const current = [row + 1];
    right.forEach((other, column) => {
      current.push(
        Math.min(
          previous[column + 1] + 1,
          current[column] + 1,
          previous[column] + (letter === other ? 0 : 1),
        ),
      );
    });
    previous = current;
  });
  return previous[right.length];
}

export function captionSimilarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - distance(left, right) / longest;
}

function bestMatch(candidates: readonly string[], caption: string): number {
  let best = -1;
  let bestScore = CAPTION_SIMILARITY;
  candidates.forEach((candidate, index) => {
    const score = captionSimilarity(candidate, caption);
    if (score >= bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

export function diffCaptions(
  before: readonly string[],
  after: readonly string[],
): { added: string[]; removed: string[] } {
  const unmatched = [...before];
  const added: string[] = [];
  for (const caption of after) {
    const index = bestMatch(unmatched, caption);
    if (index === -1) added.push(caption);
    else unmatched.splice(index, 1);
  }
  return { added, removed: unmatched };
}
