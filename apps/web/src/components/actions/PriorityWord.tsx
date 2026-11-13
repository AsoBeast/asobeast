import type { ActionItem } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { ACTION_PRIORITY_LABEL, ACTION_PRIORITY_TONE } from "./action-copy";

export const PRIORITY_COLUMNS = "grid-cols-[4rem_minmax(0,1fr)]";

export function PriorityWord({
  priority,
}: {
  priority: ActionItem["priority"];
}) {
  return (
    <span
      className={cn(
        "pt-0.5 text-tick font-semibold tracking-wide uppercase",
        ACTION_PRIORITY_TONE[priority],
      )}
    >
      {ACTION_PRIORITY_LABEL[priority]}
    </span>
  );
}
