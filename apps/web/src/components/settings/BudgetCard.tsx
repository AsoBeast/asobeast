"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPlanLimit,
  storeLabel,
} from "@/lib/format";
import { budgetOptions } from "@/lib/queries";

const WARN = 0.6;
const DANGER = 0.85;
const WARNING_COPY =
  "Daily jobs may not finish within store rate limits; remove keywords or countries, or raise SCRAPE_ITUNES_RPM at your own risk.";

function meterFor(utilization: number) {
  const pct = Math.round(utilization * 100);
  const level =
    utilization > DANGER ? "danger" : utilization > WARN ? "warn" : "ok";
  const barColor =
    level === "danger"
      ? "bg-destructive"
      : level === "warn"
        ? "bg-warning"
        : "bg-primary";
  const status =
    level === "danger"
      ? "Over capacity"
      : level === "warn"
        ? "High"
        : "Healthy";
  return { pct, level, barColor, status };
}

export function BudgetCard({
  footer,
  stepLabel,
}: { footer?: ReactNode; stepLabel?: string } = {}) {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const { pct, level, barColor, status } = meterFor(budget.utilization);

  const rows = [
    { label: "Apps", value: budget.apps },
    { label: "Keywords", value: budget.keywords },
    { label: "Categories", value: budget.categories },
    { label: "Reviews", value: budget.reviews },
  ];

  return (
    <Card>
      <CardHeader>
        {stepLabel ? <CardDescription>{stepLabel}</CardDescription> : null}
        <CardTitle>Daily request budget</CardTitle>
        <CardDescription>
          Estimated store requests the daily pipeline enqueues, against your
          rate limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatNumber(row.value)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-4">
          {budget.stores.map((store) => {
            const meter = meterFor(store.utilization);
            return (
              <div key={store.store} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{storeLabel(store.store)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(store.total)} of{" "}
                    {formatNumber(store.capacityPerDay)} requests/day ·{" "}
                    {meter.pct}%
                  </span>
                </div>
                <div
                  role="meter"
                  aria-valuenow={meter.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${storeLabel(store.store)} daily request utilization`}
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full ${meter.barColor}`}
                    style={{ width: `${Math.min(100, meter.pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              Peak store utilization · {formatNumber(budget.total)} of{" "}
              {formatNumber(budget.capacityPerDay)} requests/day
            </span>
            <span className="font-medium tabular-nums">
              {status} · {pct}%
            </span>
          </div>
          <div
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Peak store utilization"
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full ${barColor}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {budget.completion.completesAt ? (
          <p className="text-sm text-muted-foreground">
            Today&rsquo;s run is expected to finish around{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatDateTime(budget.completion.completesAt)}
            </span>
            {budget.completion.hours === null
              ? null
              : ` · about ${budget.completion.hours} hours of collection`}
          </p>
        ) : null}

        {budget.quota ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Plan usage</span>
              <span className="font-medium capitalize">
                {budget.quota.plan}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Apps</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatNumber(budget.quota.apps.used)} /{" "}
                  {formatPlanLimit(budget.quota.apps.limit)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Keyword markets</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatNumber(budget.quota.keywordMarkets.used)} /{" "}
                  {formatPlanLimit(budget.quota.keywordMarkets.limit)}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {budget.quota?.overLimitSince ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>
              Over the keyword limit since{" "}
              {formatDate(budget.quota.overLimitSince)}. Daily checks cover the
              first {formatPlanLimit(budget.quota.keywordMarkets.limit)} keyword
              markets in a stable order; remove keywords or upgrade to cover the
              rest.
            </AlertDescription>
          </Alert>
        ) : null}

        {level !== "ok" ? (
          <Alert variant={level === "danger" ? "destructive" : "default"}>
            <TriangleAlert />
            <AlertDescription>{WARNING_COPY}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
