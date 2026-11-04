import type { WebhookEvent } from "@asobeast/shared";
import {
  ALERT_RULE_GROUPS,
  ALERT_RULE_ORDER,
  ALERT_RULES,
  type AlertRule,
  type AlertRuleGroup,
} from "./alert-rules";

export interface RuleState {
  event: WebhookEvent;
  rule: AlertRule;
  on: boolean;
}

export interface RuleGroupState {
  group: AlertRuleGroup;
  rules: RuleState[];
}

export function toggleRule(
  events: readonly WebhookEvent[],
  event: WebhookEvent,
): WebhookEvent[] {
  const on = events.includes(event);
  return ALERT_RULE_ORDER.filter((candidate) =>
    candidate === event ? !on : events.includes(candidate),
  );
}

export function groupedRules(
  events: readonly WebhookEvent[],
): RuleGroupState[] {
  return ALERT_RULE_GROUPS.map((group) => ({
    group,
    rules: ALERT_RULE_ORDER.filter(
      (event) => ALERT_RULES[event].group === group,
    ).map((event) => ({
      event,
      rule: ALERT_RULES[event],
      on: events.includes(event),
    })),
  }));
}

export function ruleSummary(events: readonly WebhookEvent[]): string {
  const on = ALERT_RULE_ORDER.filter((event) => events.includes(event)).length;
  return `${on} ${on === 1 ? "rule" : "rules"} on`;
}
