export interface KeywordSteps {
  previous: string | null;
  next: string | null;
}

export const NO_STEPS: KeywordSteps = { previous: null, next: null };

export function keywordSteps(
  shownIds: readonly string[],
  keywordId: string,
): KeywordSteps {
  const at = shownIds.indexOf(keywordId);
  if (at === -1) return NO_STEPS;
  return {
    previous: shownIds[at - 1] ?? null,
    next: shownIds[at + 1] ?? null,
  };
}
