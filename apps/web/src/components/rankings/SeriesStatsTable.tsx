import { formatRankPosition, keywordLabel } from "@asobeast/shared";
import { Clock, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { formatDateInLocale, formatDayMonthInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
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
  const t = useTranslations("rankings");
  if (change === null) return DASH;
  if (change.kind === "moved") {
    return <DeltaChip value={change.places} period={period} />;
  }
  if (change.kind === "entered") {
    return <span className="font-medium text-signal-up">{t("new")}</span>;
  }
  if (change.kind === "lost") {
    return <span className="font-medium text-signal-down">{t("lost")}</span>;
  }
  return <span className="text-muted-foreground">{t("notRanked")}</span>;
}

function PositionCell({ stats }: { stats: SeriesStats }) {
  const t = useTranslations("rankings");
  const locale = useAppLocale();
  if (stats.latest === null) return DASH;
  const { position, depth, resultCount } = stats.latest;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {position === null ? (
        <span className="text-muted-foreground">
          {formatRankPosition(position, depth, resultCount)}
        </span>
      ) : (
        <GradedNumber
          value={`#${position}`}
          grade={grade("position", position)}
          label={t("position")}
          className="font-medium"
        />
      )}
      {stats.staleSince === null ? null : (
        <span
          className="inline-flex items-center gap-1 text-tick text-faint-foreground"
          title={t("lastCheckedTitle", {
            date: formatDateInLocale(stats.staleSince, locale),
          })}
        >
          <Clock className="size-3" aria-hidden />
          <span className="sr-only">{t("lastChecked")}</span>
          <span className="max-sm:sr-only">
            {formatDayMonthInLocale(stats.staleSince, locale)}
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
  const t = useTranslations("rankings");
  const format = useTranslations("format");
  const rangeText = rangeLabel(range, format);
  const period = t("periodInRange", { range: rangeText.toLowerCase() });
  return (
    <Table density="compact" containerClassName="print:overflow-visible">
      <TableCaption className="sr-only">{t("seriesCaption")}</TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-card">
          <TableHead className={LEAD}>{t("keyword")}</TableHead>
          <TableHead numeric>{t("position")}</TableHead>
          <TableHead numeric>
            {t("rangeChange", { range: rangeText })}
          </TableHead>
          <TableHead numeric className={WIDE_ONLY}>
            {t("best")}
          </TableHead>
          <TableHead numeric className={WIDE_ONLY}>
            {t("average")}
          </TableHead>
          <TableHead className="w-10 print:hidden">
            <span className="sr-only">{t("remove")}</span>
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
              <RankCell value={stats.best} label={t("bestPosition")} />
            </TableCell>
            <TableCell numeric className={WIDE_ONLY}>
              <RankCell value={stats.average} label={t("averagePosition")} />
            </TableCell>
            <TableCell className="pl-0 print:hidden">
              <Button
                variant="ghost"
                size="icon-sm"
                id={seriesRemoveId(stats.keywordId)}
                aria-label={t("removeFromChart", {
                  keyword: keywordLabel(stats),
                })}
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
