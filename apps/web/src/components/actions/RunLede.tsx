"use client";

import { Fragment } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { actionActivityScope } from "@/lib/action-filters";
import { formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { actionActivityOptions, actionSummaryFor } from "@/lib/queries";
import { NOT_GENERATED_LEDE, QUIET_RUN_LEDE, runChanges } from "./run-lede";

const joiner = (index: number, count: number): string => {
  if (index === 0) return " ";
  return index === count - 1 ? " and " : ", ";
};

export function RunLede({ appId }: { appId?: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions(actionActivityScope(appId)),
  );
  const run = runChanges(summary, activity);

  if (run.kind === "unknown") return <span>{NOT_GENERATED_LEDE}</span>;
  if (run.kind === "stale") {
    return (
      <span>{`The queue was last generated more than ${pluralize(run.days, "day")} ago.`}</span>
    );
  }
  if (run.changes.length === 0) return <span>{QUIET_RUN_LEDE}</span>;
  return (
    <>
      <span>On the day of the last run</span>
      {run.changes.map((change, index) => (
        <Fragment key={change}>
          <span>{joiner(index, run.changes.length)}</span>
          <span className="font-medium text-foreground">{change}</span>
        </Fragment>
      ))}
      <span>.</span>
    </>
  );
}

export function RunFacts({ appId }: { appId?: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const withheld =
    appId === undefined && summary.generatedAt !== null
      ? summary.suppressedByCap
      : 0;

  return (
    <span data-slot="action-status">
      {summary.generatedAt ? (
        <span>
          <span>Generated </span>
          <time dateTime={summary.generatedAt}>
            {formatDateTime(summary.generatedAt)}
          </time>
        </span>
      ) : (
        <span>Not generated yet</span>
      )}
      {withheld > 0 ? (
        <>
          <span aria-hidden> · </span>
          <span>{`${formatNumber(withheld)} withheld by the per app cap`}</span>
        </>
      ) : null}
    </span>
  );
}
