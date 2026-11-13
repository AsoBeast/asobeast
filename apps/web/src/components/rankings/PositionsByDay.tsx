import { formatCheckedPosition } from "@asobeast/shared";
import { hasCheck, type RankingChartData } from "@/components/charts/pivot";
import { RANK_TIER_KEY, rankTierTint } from "@/components/charts/rank-layers";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SeriesStats } from "./series-stats";

const CELL =
  "inline-flex h-7 min-w-11 items-center justify-center rounded-sm px-1.5 [print-color-adjust:exact]";

const STICKY = "sticky left-0 z-10 bg-card pl-4 md:pl-4";

const DAY = "px-0.5 text-center last:pr-3 md:px-0.5 md:last:pr-4";

function DayCell({
  position,
  depth,
}: {
  position: number | null;
  depth: number | null;
}) {
  const text = formatCheckedPosition(position, depth);
  if (text === null) {
    return (
      <span className={cn(CELL, "text-faint-foreground")}>
        <span aria-hidden>–</span>
        <span className="sr-only">Not checked</span>
      </span>
    );
  }
  if (position === null) {
    return (
      <span className={cn(CELL, "bg-muted text-muted-foreground")}>{text}</span>
    );
  }
  return (
    <span
      className={cn(CELL, "font-medium")}
      style={{ backgroundColor: rankTierTint(position) }}
    >
      {text}
    </span>
  );
}

export function PositionsByDay({
  chart,
  rows,
}: {
  chart: RankingChartData;
  rows: readonly SeriesStats[];
}) {
  const days = chart.rows
    .map((row, index) => ({ row, depths: chart.depths[index] }))
    .filter(({ depths }) => hasCheck(depths))
    .reverse();

  return (
    <Table
      density="compact"
      containerClassName="print:overflow-visible"
      scrollLabel="Positions by day"
      scrollFocus="overflow"
    >
      <TableCaption className="sr-only">
        The position of each charted keyword on every checked day, newest first
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-card">
          <TableHead className={STICKY}>Keyword</TableHead>
          {days.map(({ row }) => (
            <TableHead key={String(row.date)} className={DAY}>
              {formatDayMonth(String(row.date))}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((stats) => (
          <TableRow key={stats.keywordId} className="hover:bg-card">
            <TableHead
              scope="row"
              className={cn(STICKY, "text-dense text-foreground")}
            >
              <span className="flex max-w-44 items-center gap-2 sm:max-w-64">
                <bdi className="truncate font-medium">{stats.text}</bdi>
                <span className="font-normal text-faint-foreground">
                  {stats.country.toUpperCase()}
                </span>
              </span>
            </TableHead>
            {days.map(({ row, depths }) => {
              const value = row[stats.keywordId];
              return (
                <TableCell key={String(row.date)} numeric className={DAY}>
                  <DayCell
                    position={typeof value === "number" ? value : null}
                    depth={depths?.[stats.keywordId] ?? null}
                  />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RankTierKey() {
  return (
    <ul
      aria-label="Rank bands"
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      {RANK_TIER_KEY.map((tier) => (
        <li key={tier.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[2px] [print-color-adjust:exact]"
            style={{ backgroundColor: tier.tint }}
          />
          <span>{tier.label}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-[2px] bg-muted" />
        <span>Not ranked</span>
      </li>
    </ul>
  );
}
