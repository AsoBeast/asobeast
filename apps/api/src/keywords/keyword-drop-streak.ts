export interface RankedCheck {
  position: number | null;
}

const fell = (now: number | null, before: number | null): boolean =>
  before !== null && (now === null || now > before);

export function dropStreakOf(checks: readonly RankedCheck[]): number {
  let streak = 0;
  while (
    streak + 1 < checks.length &&
    fell(checks[streak].position, checks[streak + 1].position)
  ) {
    streak += 1;
  }
  return streak;
}
