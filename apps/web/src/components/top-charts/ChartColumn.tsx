"use client";

import { useId, useMemo, type ReactNode } from "react";
import Link from "next/link";
import type { AppListItem, ChartEntryItem, ChartPage } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import {
  FOOTER_LINK,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { MovementCell } from "@/components/movement/MovementCell";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFocusGroupClaim } from "@/lib/focus-handoff";
import { cn } from "@/lib/utils";
import { CaptureTodayButton } from "./CaptureTodayButton";
import {
  captureFocusKey,
  rowContextOf,
  type ChartRowContext,
} from "./chart-actions";
import {
  capturableToday,
  capturedLine,
  columnCount,
  columnRows,
  listsNoApps,
} from "./chart-column-rows";
import { ChartEmpty } from "./ChartEmpty";
import { ChartNoApps } from "./ChartNoApps";
import {
  COLLECTION_LABELS,
  shownChartKey,
  tableHref,
  type ChartSearch,
} from "./chart-params";
import { MovementBar } from "./MovementBar";
import { compareLabel } from "./movement";
import { OWN_ROW_BAR, ROW_REVEAL_GROUP, RowActions } from "./RowActions";

const ROW =
  "grid h-10 grid-cols-[1.5rem_1rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-2 text-dense transition-colors duration-150 ease-out hover:bg-muted sm:h-9";

function ChartRow({
  entry,
  context,
  period,
}: {
  entry: ChartEntryItem;
  context: ChartRowContext;
  period: string;
}) {
  const own = context.links.get(entry.storeAppId)?.role === "own";
  return (
    <li className={cn(ROW_REVEAL_GROUP, ROW, own && OWN_ROW_BAR)}>
      <span className="numeric text-right text-muted-foreground">
        {entry.position}
      </span>
      <AppIcon src={entry.iconUrl} size={16} />
      <span className="truncate font-medium" translate="no">
        <bdi>{entry.title}</bdi>
      </span>
      <RowActions entry={entry} context={context} compact />
      <span className="min-w-8 text-right text-label">
        <MovementCell entry={entry} period={period} compact />
      </span>
    </li>
  );
}

export function ChartColumn({
  page,
  apps,
  search,
}: {
  page: ChartPage;
  apps: readonly AppListItem[];
  search: Pick<ChartSearch, "compare" | "date">;
}) {
  const headingId = useId();
  const context = useMemo(
    () => rowContextOf({ chart: page.chart, apps: page.apps }, apps),
    [page.chart, page.apps, apps],
  );
  const chart = shownChartKey(page);
  const label = COLLECTION_LABELS[chart.collection];
  const period = compareLabel(page.compare, page.comparison);
  const capturable = capturableToday(page);
  const actions = useFocusGroupClaim(captureFocusKey(chart), capturable);
  const capture = capturable ? (
    <CaptureTodayButton chart={chart} variant="outline" size="sm" />
  ) : null;
  let empty: ReactNode = null;
  if (listsNoApps(page)) {
    empty = <ChartNoApps page={page} className="px-2 py-8" />;
  } else if (!page.capture) {
    empty = (
      <ChartEmpty
        className="px-2 py-8"
        captured={page.dates.length > 0}
        date={search.date}
        action={capture}
      />
    );
  }

  return (
    <Card role="region" aria-labelledby={headingId} className="gap-3">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2 id={headingId}>{label}</h2>
        </CardTitle>
        <CardAction className={PANEL_COUNT}>
          <span className="numeric">{columnCount(page, search.date)}</span>
        </CardAction>
      </CardHeader>
      {page.comparison && !empty ? (
        <MovementBar entries={page.entries} period={period} />
      ) : null}
      <CardContent className="px-2">
        {empty ?? (
          <ol className="flex flex-col">
            {columnRows(page).map((entry) => (
              <ChartRow
                key={entry.storeAppId}
                entry={entry}
                context={context}
                period={period}
              />
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
        {page.capture ? <span>{capturedLine(page.capture)}</span> : null}
        <div
          ref={actions}
          className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {page.capture ? capture : null}
          <Link href={tableHref(chart, search)} className={FOOTER_LINK}>
            <span>Open table</span>
            <span className="sr-only">{` of ${label}`}</span>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
