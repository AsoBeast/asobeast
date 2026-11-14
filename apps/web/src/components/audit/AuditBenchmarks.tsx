import Link from "next/link";
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
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type Comparison,
  comparison,
  COMPARISON_LABEL,
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
      <span>{COMPARISON_LABEL[standing]}</span>
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
  const competitorsHref = `/apps/${appId}/competitors`;
  const compared = benchmarks && benchmarks.rows.length > 0 ? benchmarks : null;

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Competitor comparison</h2>
        </CardTitle>
        {compared ? (
          <CardAction className={cn(PANEL_COUNT, "numeric")}>
            {pluralize(compared.competitors, "competitor")}
          </CardAction>
        ) : null}
      </CardHeader>
      {compared ? (
        <>
          <CardContent className={PANEL_BLEED}>
            <Table scrollLabel="Competitor comparison" scrollFocus="overflow">
              <TableCaption className="sr-only">
                {`How your listing compares with ${pluralize(compared.competitors, "competitor")}`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead numeric>You</TableHead>
                  <TableHead numeric>Competitor median</TableHead>
                  <TableHead numeric>Best</TableHead>
                  <TableHead numeric>Against the median</TableHead>
                  <TableHead className="text-right">Standing</TableHead>
                </TableRow>
              </TableHeader>
              <BenchmarkRows rows={compared.rows} />
            </Table>
          </CardContent>
          <CardFooter className="justify-between">
            <span>
              {`Read from the stored listings of ${pluralize(compared.competitors, "competitor")}`}
            </span>
            <Link
              href={competitorsHref}
              className={cn(FOOTER_LINK, "shrink-0 whitespace-nowrap")}
            >
              Open competitors
            </Link>
          </CardFooter>
        </>
      ) : (
        <CardContent>
          <EmptyState
            title="No competitors to compare with"
            body="Track a few rivals and the audit compares your listing with theirs."
            action={
              <Button asChild variant="outline">
                <Link href={competitorsHref}>Add competitors</Link>
              </Button>
            }
          />
        </CardContent>
      )}
    </Card>
  );
}
