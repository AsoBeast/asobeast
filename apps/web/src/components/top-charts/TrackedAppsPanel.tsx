"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { AppListItem, ChartPage } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { TrendLine } from "@/components/charts/Sparkline";
import {
  PANEL_BLEED,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { MovementCell } from "@/components/movement/MovementCell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryRanksOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { cn } from "@/lib/utils";
import { rowLink } from "./chart-actions";
import { COLLECTION_LABELS } from "./chart-params";
import {
  trackedRows,
  type TrackedPlace,
  type TrackedRow,
} from "./chart-summary";
import { compareLabel } from "./movement";
import { OWN_ROW_BAR } from "./RowActions";

const TREND_RANGE = "30d";
const WIDE_ONLY = "hidden @2xl/charts:table-cell";

function Place({ place, period }: { place: TrackedPlace; period: string }) {
  if (place.entry) {
    return (
      <span className="inline-flex items-center justify-end gap-2">
        <span className="hidden text-label @2xl/charts:inline">
          <MovementCell entry={place.entry} period={period} compact />
        </span>
        <span className="font-medium">{`#${place.entry.position}`}</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {place.depth === null ? "—" : `>${place.depth}`}
    </span>
  );
}

function RankTrend({
  appId,
  row,
  genre,
}: {
  appId: string;
  row: TrackedRow;
  genre: string;
}) {
  const listed = row.places.find((place) => place.entry);
  const { data, isError } = useQuery(
    categoryRanksOptions(appId, presetToRange(TREND_RANGE)),
  );
  const series = data?.series.find(
    (candidate) =>
      candidate.genre === genre && candidate.collection === listed?.collection,
  );
  const ranks = (series?.points ?? []).flatMap((point) =>
    point.position === null ? [] : [point.position],
  );
  if (isError && !data) {
    return <span className="text-muted-foreground">Unavailable</span>;
  }
  if (!listed || ranks.length < 2) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <TrendLine
      className="ml-auto"
      values={ranks.map((rank) => -rank)}
      label={`${row.title} in ${COLLECTION_LABELS[listed.collection]}, last 30 days`}
      now={`#${ranks[ranks.length - 1]}`}
    />
  );
}

function AppCell({ row }: { row: TrackedRow }) {
  const link = rowLink(row.link);
  if (!link) return null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AppIcon src={row.iconUrl} size={24} />
      <Link
        href={link.href}
        className="min-w-0 truncate rounded-sm font-medium outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
        translate="no"
      >
        <bdi>{row.title}</bdi>
      </Link>
      {row.link.role === "own" ? (
        <Badge variant="brand" className="shrink-0">
          Yours
        </Badge>
      ) : (
        <span className="hidden truncate text-caption text-faint-foreground @2xl/charts:inline">
          {link.label}
        </span>
      )}
    </div>
  );
}

export function TrackedAppsPanel({
  pages,
  apps,
}: {
  pages: readonly ChartPage[];
  apps: readonly AppListItem[];
}) {
  const rows = trackedRows(pages);
  if (rows.length === 0) return null;
  const [{ chart }] = pages;
  const captured = pages.some((page) => page.capture);
  const home = new Set(
    apps.filter((app) => app.country === chart.country).map((app) => app.id),
  );
  const title = `Your apps and competitors in ${chart.genreName}`;

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
        <CardAction className={PANEL_COUNT}>
          <span className="numeric">{`${rows.length} listed`}</span>
        </CardAction>
      </CardHeader>
      <CardContent className={PANEL_BLEED}>
        <Table>
          <TableCaption className="sr-only">{title}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              {pages.map(({ chart: { collection } }) => (
                <TableHead key={collection} numeric>
                  {COLLECTION_LABELS[collection]}
                </TableHead>
              ))}
              <TableHead numeric className={WIDE_ONLY}>
                Last 30 days
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.storeAppId}>
                <TableCell
                  className={cn(
                    "max-w-0 w-full",
                    row.link.role === "own" && OWN_ROW_BAR,
                  )}
                >
                  <AppCell row={row} />
                </TableCell>
                {row.places.map((place, index) => (
                  <TableCell key={place.collection} numeric>
                    <Place
                      place={place}
                      period={compareLabel(
                        pages[index].compare,
                        pages[index].comparison,
                      )}
                    />
                  </TableCell>
                ))}
                <TableCell numeric className={WIDE_ONLY}>
                  {row.link.role === "own" && home.has(row.link.appId) ? (
                    <RankTrend
                      appId={row.link.appId}
                      row={row}
                      genre={chart.genre}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {captured ? (
        <CardFooter>
          <span>
            Read from every listed place of each capture, not only the rows
            shown below.
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
