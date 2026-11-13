"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import {
  failedRead,
  InlineQueryError,
  type RetryableRead,
} from "@/components/layout/InlineQueryError";
import {
  LIST_HEAD,
  LIST_ROW,
  PANEL_ACTION,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { queueFilters } from "@/lib/action-filters";
import { formatNumber, pluralize } from "@/lib/format";
import { actionsOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { opensInPlace } from "./opens-in-place";
import type { SetQueueView } from "./use-queue-view";
import {
  workByApp,
  workByCategory,
  workByMarket,
  type WorkScopeRow,
} from "./work-by-scope";

const SHOWN_SCOPES = 5;
const SCOPE_COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto_2rem] gap-3 px-2";
const PRIORITY_COUNT = "text-tick font-semibold tracking-wide uppercase";

const OPEN_WORK_VIEW = {
  status: null,
  priority: null,
  rule: null,
  category: null,
  app: null,
  market: null,
  store: null,
  q: null,
};

type Split = "scope" | "type";

function scopeName(row: WorkScopeRow): string {
  return [
    row.label,
    row.counts.critical > 0
      ? `${formatNumber(row.counts.critical)} critical`
      : null,
    row.counts.high > 0 ? `${formatNumber(row.counts.high)} high` : null,
    `${formatNumber(row.total)} open`,
  ]
    .filter((part) => part !== null)
    .join(", ");
}

function ScopeLine({
  row,
  share,
  href,
  iconUrl,
  onFilter,
}: {
  row: WorkScopeRow;
  share: number;
  href: string;
  iconUrl: string | null | undefined;
  onFilter: () => void;
}) {
  return (
    <a
      href={href}
      aria-label={scopeName(row)}
      onClick={(event) => {
        if (!opensInPlace(event)) return;
        event.preventDefault();
        onFilter();
      }}
      className={cn(SCOPE_COLUMNS, LIST_ROW)}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-0 rounded-md bg-chart-tint"
        style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
      />
      <span className="relative flex min-w-0 items-center gap-2">
        {iconUrl === undefined ? null : <AppIcon src={iconUrl} size={16} />}
        <span className="truncate font-medium">{row.name}</span>
        {row.detail ? (
          <span className="text-caption text-muted-foreground">
            {row.detail}
          </span>
        ) : null}
      </span>
      <span className="numeric relative flex items-center gap-2 whitespace-nowrap">
        {row.counts.critical > 0 ? (
          <span className={cn(PRIORITY_COUNT, "text-priority-critical")}>
            {`${formatNumber(row.counts.critical)} critical`}
          </span>
        ) : null}
        {row.counts.high > 0 ? (
          <span className={cn(PRIORITY_COUNT, "text-priority-high")}>
            {`${formatNumber(row.counts.high)} high`}
          </span>
        ) : null}
      </span>
      <span className="numeric relative text-right font-medium">
        {formatNumber(row.total)}
      </span>
    </a>
  );
}

function ScopeRows({
  read,
  rows,
  head,
  line,
}: {
  read: RetryableRead;
  rows: readonly WorkScopeRow[];
  head: string;
  line: (row: WorkScopeRow) => ReactNode;
}) {
  if (read.data === undefined) {
    return (
      <div className="px-2 py-2">
        <InlineQueryError message="Could not load the open work." read={read} />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-body text-muted-foreground">
        Nothing open.
      </p>
    );
  }
  return (
    <>
      <div aria-hidden className={cn(SCOPE_COLUMNS, LIST_HEAD)}>
        <span>{head}</span>
        <span />
        <span className="text-right">Open</span>
      </div>
      <ul className="flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key}>{line(row)}</li>
        ))}
      </ul>
    </>
  );
}

export function ActionWorkByScope({
  appId,
  iconOf,
  setView,
}: {
  appId?: string;
  iconOf?: (appId: string) => string | null;
  setView: SetQueueView;
}) {
  const pathname = usePathname();
  const [split, setSplit] = useState<Split>("scope");
  const read = useQuery(actionsOptions(queueFilters(), appId));
  const { data } = read;
  if (!data && !failedRead(read)) return null;

  const scope = appId ? "market" : "app";
  const facet = split === "type" ? "category" : scope;
  const tally = {
    app: workByApp,
    market: workByMarket,
    category: workByCategory,
  };
  const rows = tally[facet](data?.items ?? []);
  const open = rows.reduce((sum, row) => sum + row.total, 0);
  const hidden = rows.length - SHOWN_SCOPES;
  const scopeLabel = appId ? "Market" : "App";

  return (
    <section aria-labelledby="where-heading">
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id="where-heading">Where the work is</h2>
          </CardTitle>
          <CardAction className={PANEL_ACTION}>
            <Tabs
              value={split}
              onValueChange={(next) =>
                setSplit(next === "type" ? "type" : "scope")
              }
            >
              <TabsList aria-label="Split the open work by">
                <TabsOption value="scope">{scopeLabel}</TabsOption>
                <TabsOption value="type">Type</TabsOption>
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          <ScopeRows
            read={read}
            rows={rows.slice(0, SHOWN_SCOPES)}
            head={split === "type" ? "Type" : scopeLabel}
            line={(row) => (
              <ScopeLine
                row={row}
                share={row.total / open}
                href={`${pathname}?${facet}=${encodeURIComponent(row.key)}`}
                iconUrl={facet === "app" ? iconOf?.(row.key) : undefined}
                onFilter={() =>
                  void setView(
                    { ...OPEN_WORK_VIEW, [facet]: [row.key] },
                    { history: "replace" },
                  )
                }
              />
            )}
          />
          {hidden > 0 ? (
            <p className="px-2 text-caption text-muted-foreground">
              {`and ${formatNumber(hidden)} more`}
            </p>
          ) : null}
          {data && data.total > data.items.length ? (
            <p className="px-2 text-caption text-muted-foreground">
              {`Counts cover the ${pluralize(data.items.length, "highest impact action")}.`}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
