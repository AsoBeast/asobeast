"use client";

import { ACTION_PRIORITIES, type ActionPriority } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { actionPriorityLabel } from "./action-copy";

export function PriorityToggles({
  selected,
  counts,
  onChange,
}: {
  selected: readonly ActionPriority[];
  counts: ReadonlyMap<ActionPriority, number>;
  onChange: (next: ActionPriority[]) => void;
}) {
  const t = useTranslations("actions");
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{t("filterPriority")}</legend>
      {ACTION_PRIORITIES.map((priority) => {
        const pressed = selected.includes(priority);
        const count = counts.get(priority) ?? 0;
        return (
          <Button
            key={priority}
            type="button"
            size="sm"
            variant={pressed ? "secondary" : "outline"}
            aria-pressed={pressed}
            aria-label={t("priorityCount", {
              priority: actionPriorityLabel(priority, t),
              count,
            })}
            onClick={() =>
              onChange(
                pressed
                  ? selected.filter((entry) => entry !== priority)
                  : [...selected, priority],
              )
            }
          >
            {actionPriorityLabel(priority, t)}
            <span aria-hidden className="numeric text-muted-foreground">
              {formatNumber(count)}
            </span>
          </Button>
        );
      })}
    </fieldset>
  );
}
