export type ActivityStatus = "all" | "active" | "paused";

export function oneOf<T>(
  value: T | undefined,
  selected: readonly T[],
): boolean {
  return value !== undefined && selected.includes(value);
}

export function statusFilter(
  row: { active: boolean },
  status: ActivityStatus,
): boolean {
  return status === "all" || row.active === (status === "active");
}
