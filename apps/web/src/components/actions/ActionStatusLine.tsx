"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionSummary } from "@asobeast/shared";
import { Separated } from "@/components/ui/separated";
import { formatDateTime, formatNumber } from "@/lib/format";
import { actionSummaryFor } from "@/lib/queries";

function statusParts(summary: ActionSummary): ReactNode[] {
  const { critical, high } = summary.openByPriority;
  return [
    `${formatNumber(summary.open)} open`,
    critical > 0 ? (
      <span className="text-priority-critical">
        {formatNumber(critical)} critical
      </span>
    ) : null,
    high > 0 ? `${formatNumber(high)} high` : null,
    summary.generatedAt ? (
      <span>
        generated{" "}
        <time dateTime={summary.generatedAt}>
          {formatDateTime(summary.generatedAt)}
        </time>
      </span>
    ) : (
      "not generated yet"
    ),
  ].filter((part) => part !== null);
}

export function ActionStatusLine({ appId }: { appId?: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));

  return (
    <p data-slot="action-status" className="text-body text-muted-foreground">
      <Separated parts={statusParts(summary)} />
      {appId === undefined && summary.suppressedByCap > 0 ? (
        <span className="hidden @md/actions:inline">
          <span aria-hidden> · </span>
          {formatNumber(summary.suppressedByCap)} withheld by the per app cap
        </span>
      ) : null}
    </p>
  );
}
