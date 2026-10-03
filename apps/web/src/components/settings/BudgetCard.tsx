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
import { formatDateTime, formatNumber, storeLabel } from "@/lib/format";
import { budgetOptions } from "@/lib/queries";
import {
  UTILIZATION_STATUS,
  utilizationLevel,
  utilizationPercent,
} from "@/lib/utilization";
import { UtilizationMeter } from "@/components/capacity/UtilizationMeter";

const WARNING_COPY =
  "Daily jobs may not finish within store rate limits; remove keywords or countries, or raise SCRAPE_ITUNES_RPM at your own risk.";

export function BudgetCard({
  footer,
  stepLabel,
}: { footer?: ReactNode; stepLabel?: string } = {}) {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const level = utilizationLevel(budget.utilization);

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
          {budget.stores.map((store) => (
            <div key={store.store} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{storeLabel(store.store)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumber(store.total)} of{" "}
                  {formatNumber(store.capacityPerDay)} requests/day ·{" "}
                  {utilizationPercent(store.utilization)}%
                </span>
              </div>
              <UtilizationMeter
                label={`${storeLabel(store.store)} daily request utilization`}
                utilization={store.utilization}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              Peak store utilization · {formatNumber(budget.total)} of{" "}
              {formatNumber(budget.capacityPerDay)} requests/day
            </span>
            <span className="font-medium tabular-nums">
              {UTILIZATION_STATUS[level]} ·{" "}
              {utilizationPercent(budget.utilization)}%
            </span>
          </div>
          <UtilizationMeter
            label="Peak store utilization"
            utilization={budget.utilization}
          />
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
