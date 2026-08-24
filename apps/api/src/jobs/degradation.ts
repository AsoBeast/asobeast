export const DEGRADATION_ORDER = [
  'categories',
  'reviews',
  'apps',
  'keywords',
] as const;

export type DailyStage = (typeof DEGRADATION_ORDER)[number];

export const PRESSURE_SHED_SECONDARY = 1;
export const PRESSURE_SHED_REFRESH = 1.5;

export interface DegradationPlan {
  pressure: number;
  skipped: DailyStage[];
}

export function planDegradation(input: {
  demand: number;
  backlog: number;
  capacityPerDay: number;
}): DegradationPlan {
  const { demand, backlog, capacityPerDay } = input;
  if (capacityPerDay <= 0) return { pressure: 0, skipped: [] };

  const pressure =
    Math.round(((demand + backlog) / capacityPerDay) * 1000) / 1000;
  if (pressure <= PRESSURE_SHED_SECONDARY) return { pressure, skipped: [] };
  if (pressure <= PRESSURE_SHED_REFRESH) {
    return { pressure, skipped: ['categories', 'reviews'] };
  }
  return { pressure, skipped: ['categories', 'reviews', 'apps'] };
}
