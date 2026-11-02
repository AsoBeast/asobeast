export const REVIEW_SCORES = [1, 2, 3, 4, 5] as const;
export type ReviewScore = (typeof REVIEW_SCORES)[number];

const coversEveryScore = (scores: readonly number[]): boolean =>
  REVIEW_SCORES.every((score) => scores.includes(score));

export function normalizeReviewScores(raw: readonly number[]): number[] {
  const unique = [...new Set(raw)].sort((left, right) => left - right);
  return unique.length === REVIEW_SCORES.length && coversEveryScore(unique)
    ? []
    : unique;
}

export function listsReviewScore(
  reviewScores: readonly number[] | undefined,
  score: number,
): boolean {
  return (
    reviewScores === undefined ||
    reviewScores.length === 0 ||
    reviewScores.includes(score)
  );
}

export function selectedReviewScores(
  reviewScores: readonly number[] | undefined,
): ReviewScore[] {
  const picked = REVIEW_SCORES.filter(
    (score) => reviewScores?.includes(score) ?? false,
  );
  return picked.length === 0 ? [...REVIEW_SCORES] : picked;
}

export function reviewScoresLabel(
  reviewScores: readonly number[] | undefined,
): string {
  const selected = selectedReviewScores(reviewScores);
  if (selected.length === REVIEW_SCORES.length) return 'every star';
  const first = selected[0];
  const last = selected[selected.length - 1];
  const noun = last === 1 ? 'star' : 'stars';
  if (selected.length === 1) return `${first} ${noun}`;
  if (selected.length >= 3 && last - first + 1 === selected.length) {
    return `${first} to ${last} ${noun}`;
  }
  return `${selected.slice(0, -1).join(', ')} and ${last} ${noun}`;
}
