export const DIFFICULTY_DISPLAY_MAX = 100;

export function toDifficulty100(difficulty: number): number {
  return Math.min(DIFFICULTY_DISPLAY_MAX, Math.max(0, difficulty * 10));
}
