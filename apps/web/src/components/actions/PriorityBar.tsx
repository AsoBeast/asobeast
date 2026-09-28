import type { ActionPriority, ActionPriorityCounts } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { prioritySegments } from "./priority-bar";

const PRIORITY_FILL: Record<ActionPriority, string> = {
  critical: "bg-priority-critical",
  high: "bg-priority-high",
  medium: "bg-priority-medium",
  low: "bg-priority-low",
};

export function PriorityBar({ counts }: { counts: ActionPriorityCounts }) {
  const segments = prioritySegments(counts);
  if (segments.length === 0) return null;

  return (
    <div
      aria-hidden
      data-slot="priority-bar"
      className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
    >
      {segments.map((segment) => (
        <div
          key={segment.priority}
          className={cn("h-full", PRIORITY_FILL[segment.priority])}
          style={{ flexGrow: segment.share }}
        />
      ))}
    </div>
  );
}
