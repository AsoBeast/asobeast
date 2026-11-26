"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  DailyBudget,
  PortfolioTotals,
  RunState,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { META_LINE } from "@/components/layout/panel-classes";
import { Separated } from "@/components/ui/separated";
import { formatDateInLocale } from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  budgetOptions,
  portfolioOptions,
  runStatusOptions,
} from "@/lib/queries";

const RUN_STATE_KEYS: Record<RunState, string | null> = {
  idle: null,
  running: "running",
  complete: "complete",
  delayed: "delayed",
};

function inventory(totals: PortfolioTotals, t: MessageTranslator): ReactNode[] {
  return [
    t("counts.apps", { count: totals.apps }),
    t("counts.keywords", { count: totals.trackedKeywords }),
    t("counts.competitors", { count: totals.competitors }),
  ];
}

function budgetShare(utilization: number): string {
  const percent = Math.round(utilization * 100);
  return percent === 0 ? "<1%" : `${percent}%`;
}

function freshness(
  run: WorkspaceRunStatus,
  budget: DailyBudget | null,
  t: ReturnType<typeof useTranslations>,
  locale: ReturnType<typeof useAppLocale>,
): ReactNode[] {
  const stateKey = RUN_STATE_KEYS[run.state];
  return [
    run.lastCaptureAt
      ? t.rich("status.collected", {
          date: formatDateInLocale(run.lastCaptureAt, locale),
          time: (chunks) => (
            <time dateTime={run.lastCaptureAt ?? undefined}>{chunks}</time>
          ),
        })
      : null,
    stateKey === null ? null : t(`status.${stateKey}`),
    budget && budget.utilization > 0 ? (
      <Link href="/settings" className="underline-offset-4 hover:underline">
        {t("status.budgetShare", { percent: budgetShare(budget.utilization) })}
      </Link>
    ) : null,
  ].filter((part) => part !== null);
}

export function PortfolioStatusLine() {
  return <StatusLine budget={null} />;
}

export function OperatorPortfolioStatusLine() {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  return <StatusLine budget={budget} />;
}

function StatusLine({ budget }: { budget: DailyBudget | null }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: run } = useSuspenseQuery(runStatusOptions);
  const fresh = freshness(run, budget, t, locale);

  return (
    <p data-slot="portfolio-status" className={META_LINE}>
      <Separated parts={[...inventory(portfolio.totals, t), ...fresh]} />
    </p>
  );
}
