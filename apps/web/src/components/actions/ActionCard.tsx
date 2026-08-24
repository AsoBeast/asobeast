"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ActionItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCountry, storeLabel } from "@/lib/format";
import {
  ACTION_CATEGORY_LABEL,
  ACTION_RULE_TITLE,
  ACTION_STATUS_LABEL,
  summarizeEvidence,
} from "./action-copy";
import { actionHref } from "./action-links";
import { ActionEvidencePanel } from "./ActionEvidencePanel";
import { ActionExplain } from "./ActionExplain";
import { ActionImpactMeter } from "./ActionImpactMeter";
import { ActionPriorityBadge } from "./ActionPriorityBadge";
import { StatusIcon } from "./ActionStatusIcon";
import { ActionStateControls } from "./ActionStateControls";

export function ActionCard({
  item,
  focused,
}: {
  item: ActionItem;
  focused?: boolean;
}) {
  return (
    <Card
      id={`action-${item.id}`}
      data-focused={focused ? "true" : undefined}
      className="data-[focused=true]:ring-2 data-[focused=true]:ring-ring"
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ActionPriorityBadge priority={item.priority} />
          <Badge variant="secondary">
            {ACTION_CATEGORY_LABEL[item.category]}
          </Badge>
          {item.status !== "OPEN" && (
            <Badge variant="outline">
              <StatusIcon status={item.status} />
              {ACTION_STATUS_LABEL[item.status]}
            </Badge>
          )}
          {item.reopenCount > 0 && (
            <Badge variant="outline">Reopened {item.reopenCount}×</Badge>
          )}
        </div>
        <h2 className="text-base font-semibold">
          {ACTION_RULE_TITLE[item.rule]}
        </h2>
        <p className="text-sm text-muted-foreground">
          {item.scope.appName ?? "An app"} · {storeLabel(item.scope.store)} ·{" "}
          {formatCountry(item.scope.country)}
          {item.scope.keywordText ? ` · "${item.scope.keywordText}"` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActionImpactMeter impact={item.impact} />
        {item.evidence && (
          <p className="text-sm">{summarizeEvidence(item.evidence)}</p>
        )}
        <ActionEvidencePanel
          evidence={item.evidence}
          degraded={item.degraded}
          lastSeenAt={item.lastSeenAt}
        />
        <ActionExplain item={item} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={actionHref(item)}
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Open the workspace that fixes this
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <ActionStateControls item={item} />
        </div>
      </CardContent>
    </Card>
  );
}
