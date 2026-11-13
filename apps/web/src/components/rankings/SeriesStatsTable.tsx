import { formatRankPosition, keywordLabel } from "@asobeast/shared";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeltaChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDayMonth } from "@/lib/format";
import { grade } from "@/lib/grade";
import { rangeLabel, type RangePreset } from "@/lib/ranges";
import { cn } from "@/lib/utils";
import { SeriesSwatch } from "./SeriesSwatch";
import type { RangeChange, SeriesStats } from "./series-stats";

const DASH = <span className="text-muted-foreground">—</span>;

const WIDE_ONLY = "hidden sm:table-cell";

const LEAD = "pl-4 md:pl-4";

export const seriesRemoveId = (keywordId: string): string =>
  `rankings-series-remove-${keywordId}`;

function ChangeCell({
  change,
  period,
}: {
  change: RangeChange | null;
  period: string;
}) {
  if (change === null) return DASH;
  if (change.kind === "moved") {
    return <DeltaChip value={change.places} period={period} />;
  }
  if (change.kind === "entered") {
    return <span className="font-medium text-signal-up">New</span>;
  }
  if (change.kind === "lost") {
    return <span className="font-medium text-signal-down">Lost</span>;
  }
  return <span className="text-muted-foreground">Not ranked</span>;
}

function PositionCell({ stats }: { stats: SeriesStats }) {
  if (stats.latest === null) return DASH;
  const { position, depth } = stats.latest;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {position === null ? (
        <span className="text-muted-foreground">
          {formatRankPosition(position, depth)}
        </span>
      ) : (
        <GradedNumber
          value={`#${position}`}
          grade={grade("position", position)}
          label="Position"
          className="font-medium"
        />
      )}
      {stats.staleSince === null ? null : (
        <span
          className="inline-flex items-center gap-1 text-tick text-faint-foreground"
          title={`Last checked ${formatDate(stats.staleSince)}`}
        >
          <Clock className="size-3" aria-hidden />
          <span className="sr-only">last checked </span>
          <span className="max-sm:sr-only">
            {formatDayMonth(stats.staleSince)}
          </span>
        </span>
      )}
    </span>
  );
}

function RankCell({ value, label }: { value: number | null; label: string }) {
  if (value === null) return DASH;
  return (
    <GradedNumber
      value={`#${value}`}
      grade={grade("position", value)}
      label={label}
    />
  );
}

export function SeriesStatsTable({
  rows,
  range,
  onRemove,
}: {
  rows: readonly SeriesStats[];
  range: RangePreset;
  onRemove: (keywordId: string, trigger: HTMLElement) => void;
}) {
  const period = `in the ${rangeLabel(range).toLowerCase()}`;
  return (
    <Table density="compact" containerClassName="print:overflow-visible">
      <TableCaption className="sr-only">
        Charted keywords with their position, change, best and average
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-card">
          <TableHead className={LEAD}>Keyword</TableHead>
          <TableHead numeric>Position</TableHead>
          <TableHead numeric>{`${range} change`}</TableHead>
          <TableHead numeric className={WIDE_ONLY}>
            Best
          </TableHead>
          <TableHead numeric className={WIDE_ONLY}>
            Average
          </TableHead>
          <TableHead className="w-10 print:hidden">
            <span className="sr-only">Remove</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((stats, index) => (
          <TableRow key={stats.keywordId}>
            <TableCell className={cn(LEAD, "w-full max-w-0")}>
              <span className="flex min-w-0 items-center gap-2.5">
                <SeriesSwatch index={index} />
                <bdi className="truncate font-medium print:whitespace-normal">
                  {stats.text}
                </bdi>
                <span className="text-faint-foreground">
                  {stats.country.toUpperCase()}
                </span>
              </span>
            </TableCell>
            <TableCell numeric>
              <PositionCell stats={stats} />
            </TableCell>
            <TableCell numeric>
              <ChangeCell change={stats.change} period={period} />
            </TableCell>
            <TableCell numeric className={WIDE_ONLY}>
              <RankCell value={stats.best} label="Best position" />
            </TableCell>
            <TableCell numeric className={WIDE_ONLY}>
              <RankCell value={stats.average} label="Average position" />
            </TableCell>
            <TableCell className="pl-0 print:hidden">
              <Button
                variant="ghost"
                size="icon-sm"
                id={seriesRemoveId(stats.keywordId)}
                aria-label={`Remove ${keywordLabel(stats)} from the chart`}
                onClick={(event) =>
                  onRemove(stats.keywordId, event.currentTarget)
                }
              >
                <X />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
