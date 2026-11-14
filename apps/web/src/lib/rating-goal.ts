export const RATING_GOAL_DEFAULT_DAYS = 30;
export const RATING_GOAL_NOTE_MAX_COUNT = 20;

export function ratingGoalDefaultTarget(avg: number): number {
  return Math.min(Math.round((Math.round(avg * 10) / 10 + 0.1) * 10) / 10, 5);
}

export type RatingGoal =
  | { kind: "already"; target: number }
  | { kind: "needed"; needed: number; target: number };

export function ratingGoalNeeded(
  count: number,
  avg: number,
  target: number,
): RatingGoal {
  const threshold = target - 0.05;
  if (avg >= threshold) return { kind: "already", target };
  if (count <= 0) return { kind: "needed", needed: 1, target };
  const needed = Math.ceil(
    (count * (threshold - avg)) / (5 - threshold) - 1e-9,
  );
  return { kind: "needed", needed, target };
}
