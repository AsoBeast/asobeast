import { ACTION_PRIORITIES, type ActionPriority } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { formatNumber, pluralize } from "@/lib/format";
import { ACTION_PRIORITY_LABEL } from "./action-copy";

export function PriorityToggles({
  selected,
  counts,
  onChange,
}: {
  selected: readonly ActionPriority[];
  counts: ReadonlyMap<ActionPriority, number>;
  onChange: (next: ActionPriority[]) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Filter by priority</legend>
      {ACTION_PRIORITIES.map((priority) => {
        const pressed = selected.includes(priority);
        const count = counts.get(priority) ?? 0;
        return (
          <Button
            key={priority}
            type="button"
            size="sm"
            variant={pressed ? "default" : "outline"}
            aria-pressed={pressed}
            aria-label={`${ACTION_PRIORITY_LABEL[priority]}, ${pluralize(count, "action")}`}
            onClick={() =>
              onChange(
                pressed
                  ? selected.filter((entry) => entry !== priority)
                  : [...selected, priority],
              )
            }
          >
            {ACTION_PRIORITY_LABEL[priority]}
            <span aria-hidden className="numeric font-mono">
              {formatNumber(count)}
            </span>
          </Button>
        );
      })}
    </fieldset>
  );
}
