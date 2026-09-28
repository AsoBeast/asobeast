import type { ActionStatus } from "@asobeast/shared";
import { ACTION_DEFAULT_STATUSES } from "@/lib/search-params";

export const STATUS_PRESETS = [
  { key: "todo", label: "To do", statuses: ACTION_DEFAULT_STATUSES },
  { key: "DONE", label: "Done", statuses: ["DONE"] },
  { key: "DISMISSED", label: "Dismissed", statuses: ["DISMISSED"] },
  { key: "RESOLVED", label: "Resolved", statuses: ["RESOLVED"] },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  statuses: readonly ActionStatus[];
}>;

export type StatusPreset = (typeof STATUS_PRESETS)[number];

export function presetOf(status: readonly ActionStatus[]): StatusPreset | null {
  return (
    STATUS_PRESETS.find(
      (preset) =>
        preset.statuses.length === status.length &&
        preset.statuses.every((value: ActionStatus) => status.includes(value)),
    ) ?? null
  );
}

export function presetCount(
  preset: StatusPreset,
  byStatus: Record<ActionStatus, number>,
): number {
  return preset.statuses.reduce(
    (sum: number, status: ActionStatus) => sum + byStatus[status],
    0,
  );
}
