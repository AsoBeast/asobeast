"use client";

import { useId } from "react";
import type { WebhookEvent } from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import type { RuleControl } from "../alert-rules";
import { groupedRules, ruleSummary, toggleRule } from "../alert-rules-state";
import { RatingDropSelection, ReviewStarSelection } from "../alert-events";
import { AlertRuleRow } from "./AlertRuleRow";

export interface AlertRulesProps {
  events: WebhookEvent[];
  stars: number[];
  ratingTenths: number;
  onEventsChange: (next: WebhookEvent[]) => void;
  onStarsChange: (next: number[]) => void;
  onRatingTenthsChange: (next: number) => void;
}

function RuleControlField({
  control,
  props,
}: {
  control: RuleControl;
  props: AlertRulesProps;
}) {
  if (control === "review-stars") {
    return (
      <ReviewStarSelection value={props.stars} onChange={props.onStarsChange} />
    );
  }
  if (control === "rating-tenths") {
    return (
      <RatingDropSelection
        value={props.ratingTenths}
        onChange={props.onRatingTenthsChange}
      />
    );
  }
  return null;
}

export function AlertRules(props: AlertRulesProps) {
  const labelId = useId();
  const summaryId = useId();
  const toggle = (event: WebhookEvent) =>
    props.onEventsChange(toggleRule(props.events, event));

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={summaryId}
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <Label id={labelId}>Alert rules</Label>
        <span id={summaryId} className="text-sm text-muted-foreground">
          {ruleSummary(props.events)}
        </span>
      </div>
      {groupedRules(props.events).map(({ group, rules }) => (
        <fieldset key={group} className="min-w-0">
          <legend className="text-sm font-medium text-muted-foreground">
            {group}
          </legend>
          <ul className="divide-y">
            {rules.map(({ event, rule, on }) => (
              <AlertRuleRow
                key={event}
                event={event}
                rule={rule}
                on={on}
                onToggle={toggle}
              >
                {rule.control === "none" ? null : (
                  <RuleControlField control={rule.control} props={props} />
                )}
              </AlertRuleRow>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
