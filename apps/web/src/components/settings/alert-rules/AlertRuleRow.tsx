"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { WebhookEvent } from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AlertRule } from "../alert-rules";
import { alertRuleCopy } from "../alert-rules";

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
  const t = useTranslations("notifications");
  const switchId = useId();
  const titleId = useId();
  const detailId = useId();
  const copy = alertRuleCopy(rule, t);

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
            {copy.title}
          </Label>
          <p id={detailId} className="text-dense text-muted-foreground">
            {copy.detail}
          </p>
          {on && children ? <div className="pt-2">{children}</div> : null}
        </div>
      </div>
    </li>
  );
}
