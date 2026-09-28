"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ActionItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCountry, storeLabel } from "@/lib/format";
import {
  ACTION_CATEGORY_LABEL,
  ACTION_EVIDENCE_UNAVAILABLE,
  ACTION_STATUS_LABEL,
  summarizeEvidence,
} from "./action-copy";
import { actionHeadline } from "./action-headline";
import { actionHref } from "./action-links";
import { ActionImpactMeter } from "./ActionImpactMeter";
import { ActionPriorityBadge } from "./ActionPriorityBadge";
import { StatusIcon } from "./ActionStatusIcon";
import { ActionStateControls } from "./ActionStateControls";

function opensInPlace(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function ActionCard({
  item,
  focused,
  href,
  onOpen,
}: {
  item: ActionItem;
  focused?: boolean;
  href: string;
  onOpen: () => void;
}) {
  return (
    <Card
      id={`action-${item.id}`}
      tabIndex={-1}
      data-focused={focused ? "true" : undefined}
      className="outline-none data-[focused=true]:ring-2 data-[focused=true]:ring-ring"
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
          <a
            href={href}
            className="underline-offset-4 hover:underline"
            onClick={(event) => {
              if (!opensInPlace(event)) return;
              event.preventDefault();
              onOpen();
            }}
          >
            {actionHeadline(item)}
          </a>
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
        {item.degraded && (
          <p className="text-sm text-muted-foreground">
            {ACTION_EVIDENCE_UNAVAILABLE}
          </p>
        )}
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
