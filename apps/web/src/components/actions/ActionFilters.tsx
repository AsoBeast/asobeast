"use client";

import {
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  type ActionPriority,
  type ActionRule,
  type ActionStatus,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  ACTION_PRIORITY_LABEL,
  ACTION_RULE_LABEL,
  ACTION_RULE_TITLE,
  ACTION_STATUS_LABEL,
} from "./action-copy";

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function ActionFilters({
  status,
  priority,
  rule,
  onStatusChange,
  onPriorityChange,
  onRuleChange,
}: {
  status: ActionStatus[];
  priority: ActionPriority[];
  rule: ActionRule[];
  onStatusChange: (next: ActionStatus[]) => void;
  onPriorityChange: (next: ActionPriority[]) => void;
  onRuleChange: (next: ActionRule[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Filter by status</legend>
        <span className="text-xs font-medium text-muted-foreground">
          Status
        </span>
        {ACTION_STATUSES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={status.includes(value) ? "default" : "outline"}
            aria-pressed={status.includes(value)}
            onClick={() => onStatusChange(toggle(status, value))}
          >
            {ACTION_STATUS_LABEL[value]}
          </Button>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Filter by priority</legend>
        <span className="text-xs font-medium text-muted-foreground">
          Priority
        </span>
        {ACTION_PRIORITIES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={priority.includes(value) ? "default" : "outline"}
            aria-pressed={priority.includes(value)}
            onClick={() => onPriorityChange(toggle(priority, value))}
          >
            {ACTION_PRIORITY_LABEL[value]}
          </Button>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Filter by rule</legend>
        <span className="text-xs font-medium text-muted-foreground">Rule</span>
        {ACTION_RULES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={rule.includes(value) ? "default" : "outline"}
            aria-pressed={rule.includes(value)}
            title={ACTION_RULE_TITLE[value]}
            onClick={() => onRuleChange(toggle(rule, value))}
          >
            {ACTION_RULE_LABEL[value]}
          </Button>
        ))}
      </fieldset>
    </div>
  );
}
