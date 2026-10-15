"use client";

import { useId } from "react";
import Link from "next/link";
import type { ChartPage } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { CaptureTodayButton } from "./CaptureTodayButton";
import {
  capturableToday,
  columnCaption,
  columnRows,
} from "./chart-column-rows";
import { ChartEmpty } from "./ChartEmpty";
import {
  COLLECTION_LABELS,
  shownChartKey,
  tableHref,
  type ChartSearch,
} from "./chart-params";
import { compareLabel } from "./movement";
import { MovementCell } from "./MovementCell";

export function ChartColumn({
  page,
  search,
}: {
  page: ChartPage;
  search: Pick<ChartSearch, "compare" | "date">;
}) {
  const headingId = useId();
  const chart = shownChartKey(page);
  const label = COLLECTION_LABELS[chart.collection];
  const period = compareLabel(page.compare, page.comparison);
  const capture = capturableToday(page) ? (
    <CaptureTodayButton chart={chart} variant="outline" size="sm" />
  ) : null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id={headingId} className="text-title">
            {label}
          </h2>
          <p className="text-caption text-muted-foreground">
            {columnCaption(page, search.date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {page.capture ? capture : null}
          <Link
            href={tableHref(chart, search)}
            className="text-sm underline decoration-primary underline-offset-4"
          >
            Open table<span className="sr-only"> of {label}</span>
          </Link>
        </div>
      </div>
      {page.capture ? (
        <ol className="flex flex-col divide-y">
          {columnRows(page).map((entry) => (
            <li
              key={entry.storeAppId}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="numeric w-7 shrink-0 text-right font-mono">
                {entry.position}
              </span>
              <AppIcon src={entry.iconUrl} name={entry.title} size={28} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium" translate="no">
                  {entry.title}
                </span>
                {entry.developer ? (
                  <span className="truncate text-caption text-muted-foreground">
                    {entry.developer}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-right">
                <MovementCell entry={entry} period={period} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ChartEmpty
          className="px-4 py-8"
          captured={page.dates.length > 0}
          date={search.date}
          action={capture}
        />
      )}
    </section>
  );
}
