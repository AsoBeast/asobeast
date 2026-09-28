"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  DailyBudget,
  PortfolioTotals,
  RunState,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { Separated } from "@/components/ui/separated";
import { formatDate, pluralize } from "@/lib/format";
import {
  budgetOptions,
  portfolioOptions,
  runStatusOptions,
} from "@/lib/queries";

const RUN_STATE_TEXT: Record<RunState, string | null> = {
  idle: null,
  running: "Daily run in progress",
  complete: "Daily run complete",
  delayed: "Daily run delayed",
};

function inventory(totals: PortfolioTotals): ReactNode[] {
  return [
    pluralize(totals.apps, "app"),
    pluralize(totals.trackedKeywords, "keyword"),
    pluralize(totals.competitors, "competitor"),
  ];
}

function budgetShare(utilization: number): string {
  const percent = Math.round(utilization * 100);
  return percent === 0 ? "<1%" : `${percent}%`;
}

function freshness(run: WorkspaceRunStatus, budget: DailyBudget): ReactNode[] {
  const state = RUN_STATE_TEXT[run.state];
  return [
    run.lastCaptureAt ? (
      <span>
        Collected{" "}
        <time dateTime={run.lastCaptureAt}>
          {formatDate(run.lastCaptureAt)}
        </time>
      </span>
    ) : null,
    state,
    budget.utilization > 0 ? (
      <Link href="/settings" className="underline-offset-4 hover:underline">
        {budgetShare(budget.utilization)} of the daily request budget
      </Link>
    ) : null,
  ].filter((part) => part !== null);
}

export function PortfolioStatusLine() {
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const { data: run } = useSuspenseQuery(runStatusOptions);
  const fresh = freshness(run, budget);

  return (
    <div
      data-slot="portfolio-status"
      className="flex flex-col gap-1 text-body text-muted-foreground"
    >
      <p>
        <Separated parts={inventory(portfolio.totals)} />
      </p>
      {fresh.length > 0 ? (
        <p>
          <Separated parts={fresh} />
        </p>
      ) : null}
    </div>
  );
}
