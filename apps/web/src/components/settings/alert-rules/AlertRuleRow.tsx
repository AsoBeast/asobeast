"use client";

import { useId, type ReactNode } from "react";
import type { WebhookEvent } from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AlertRule } from "../alert-rules";

export function AlertRuleRow({
  event,
  rule,
  on,
  onToggle,
  children,
}: {
  event: WebhookEvent;
  rule: AlertRule;
  on: boolean;
  onToggle: (event: WebhookEvent) => void;
  children?: ReactNode;
}) {
  const switchId = useId();
  const titleId = useId();
  const detailId = useId();

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <Switch
          id={switchId}
          checked={on}
          aria-labelledby={titleId}
          aria-describedby={detailId}
          className="mt-0.5"
          onCheckedChange={() => onToggle(event)}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Label id={titleId} htmlFor={switchId}>
            {rule.title}
          </Label>
          <p id={detailId} className="text-sm text-muted-foreground">
            {rule.detail}
          </p>
          {on && children ? <div className="pt-2">{children}</div> : null}
        </div>
      </div>
    </li>
  );
}
