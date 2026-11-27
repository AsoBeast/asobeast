"use client";

import Link from "next/link";
import { LIST_HEAD, LIST_ROW } from "@/components/layout/panel-classes";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  detail?: string;
  share?: number;
  href?: string;
}

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(2.5rem,auto)] gap-3 px-2";

const BAR_MAX = 0.6;

function RowBody({
  row,
  locale,
}: {
  row: BreakdownRow;
  locale: ReturnType<typeof useAppLocale>;
}) {
  return (
    <>
      {row.share !== undefined ? (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 rounded-md bg-chart-tint"
          style={{
            width: `${Math.max(1, Math.round(row.share * BAR_MAX * 100))}%`,
          }}
        />
      ) : null}
      <span className="relative truncate">{row.label}</span>
      <span className="numeric relative text-right text-muted-foreground">
        {row.detail ?? ""}
      </span>
      <span className="numeric relative text-right font-medium">
        {formatNumberInLocale(row.count, locale)}
      </span>
    </>
  );
}

export function BreakdownList({
  rows,
  label,
  heads,
}: {
  rows: readonly BreakdownRow[];
  label: string;
  heads?: { label: string; detail?: string; count: string };
}) {
  const locale = useAppLocale();
  const nameOf = (row: BreakdownRow) =>
    [row.label, formatNumberInLocale(row.count, locale), row.detail]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="flex flex-col gap-1">
      {heads ? (
        <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
          <span>{heads.label}</span>
          <span className="text-right">{heads.detail ?? ""}</span>
          <span className="text-right">{heads.count}</span>
        </div>
      ) : null}
      <ul aria-label={label} className="flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                aria-label={nameOf(row)}
                className={cn(COLUMNS, LIST_ROW)}
              >
                <RowBody row={row} locale={locale} />
              </Link>
            ) : (
              <div className={cn(COLUMNS, LIST_ROW, "hover:bg-transparent")}>
                <RowBody row={row} locale={locale} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
