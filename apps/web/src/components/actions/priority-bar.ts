import {
  ACTION_PRIORITIES,
  type ActionPriority,
  type ActionPriorityCounts,
} from "@asobeast/shared";

export interface PrioritySegment {
  priority: ActionPriority;
  count: number;
  share: number;
}

export function prioritySegments(
  counts: ActionPriorityCounts,
): PrioritySegment[] {
  const total = ACTION_PRIORITIES.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  return ACTION_PRIORITIES.filter((key) => counts[key] > 0).map((key) => ({
    priority: key,
    count: counts[key],
    share: counts[key] / total,
  }));
}
