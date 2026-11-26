"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type {
  AuditBenchmarkRow,
  AuditBenchmarks as Benchmarks,
} from "@asobeast/shared";
import {
  FOOTER_LINK,
  PANEL_BLEED,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  type Comparison,
  comparison,
  formatBenchmarkValue,
  medianGap,
} from "./benchmark-comparison";

const STANDING_TONE: Record<Comparison, string> = {
  ahead: "text-signal-up",
  behind: "text-signal-down",
  even: "text-muted-foreground",
  unknown: "text-muted-foreground",
};

const STANDING_ARROW: Partial<Record<Comparison, "up" | "down">> = {
  ahead: "up",
  behind: "down",
};

function Standing({ row }: { row: AuditBenchmarkRow }) {
  const t = useTranslations("audit");
  const standing = comparison(row);
  const way = STANDING_ARROW[standing];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-label",
        STANDING_TONE[standing],
      )}
    >
      {way ? <DirectionArrow way={way} className="size-3" /> : null}
      <span>{t(`benchmarks.${standing}`)}</span>
    </span>
  );
}

function BenchmarkRows({ rows }: { rows: AuditBenchmarkRow[] }) {
  return (
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.metric}>
          <TableCell>
            <span>{row.label}</span>
          </TableCell>
          <TableCell numeric className="font-medium">
            <span>{formatBenchmarkValue(row.metric, row.you)}</span>
          </TableCell>
          <TableCell numeric>
            <span>{formatBenchmarkValue(row.metric, row.median)}</span>
          </TableCell>
          <TableCell numeric>
            <span>{formatBenchmarkValue(row.metric, row.best)}</span>
          </TableCell>
          <TableCell numeric className="text-muted-foreground">
            <span>{medianGap(row) ?? "—"}</span>
          </TableCell>
          <TableCell className="text-right">
            <Standing row={row} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export function AuditBenchmarks({
  appId,
  benchmarks,
}: {
  appId: string;
  benchmarks: Benchmarks | null | undefined;
}) {
  const t = useTranslations("audit");
  const competitorsHref = `/apps/${appId}/competitors`;
  const compared = benchmarks && benchmarks.rows.length > 0 ? benchmarks : null;

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("benchmarks.title")}</h2>
        </CardTitle>
        {compared ? (
          <CardAction className={cn(PANEL_COUNT, "numeric")}>
            {t("competitorCount", { count: compared.competitors })}
          </CardAction>
        ) : null}
      </CardHeader>
      {compared ? (
        <>
          <CardContent className={PANEL_BLEED}>
            <Table scrollLabel={t("benchmarks.aria")} scrollFocus="overflow">
              <TableCaption className="sr-only">
                {t("benchmarkCaption", { count: compared.competitors })}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("benchmarks.metric")}</TableHead>
                  <TableHead numeric>{t("benchmarks.you")}</TableHead>
                  <TableHead numeric>{t("benchmarks.median")}</TableHead>
                  <TableHead numeric>{t("benchmarks.best")}</TableHead>
                  <TableHead numeric>{t("benchmarks.againstMedian")}</TableHead>
                  <TableHead className="text-right">
                    {t("benchmarks.standing")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <BenchmarkRows rows={compared.rows} />
            </Table>
          </CardContent>
          <CardFooter className="justify-between">
            <span>{t("benchmarkFooter", { count: compared.competitors })}</span>
            <Link
              href={competitorsHref}
              className={cn(FOOTER_LINK, "shrink-0 whitespace-nowrap")}
            >
              {t("openCompetitors")}
            </Link>
          </CardFooter>
        </>
      ) : (
        <CardContent>
          <EmptyState
            title={t("benchmarks.emptyTitle")}
            body={t("benchmarks.emptyBody")}
            action={
              <Button asChild variant="outline">
                <Link href={competitorsHref}>{t("benchmarks.add")}</Link>
              </Button>
            }
          />
        </CardContent>
      )}
    </Card>
  );
}
