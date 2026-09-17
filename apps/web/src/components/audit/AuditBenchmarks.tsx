import Link from "next/link";
import type {
  AuditBenchmarkRow,
  AuditBenchmarks as Benchmarks,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { comparison, COMPARISON_LABEL } from "./benchmark-comparison";

const cell = (value: number | null): string =>
  value === null ? "—" : String(value);

function YouCell({ row }: { row: AuditBenchmarkRow }) {
  const best = row.best;
  const you = row.you;
  const ratio =
    best === null || you === null || best === 0
      ? 0
      : row.better === "higher"
        ? you / best
        : best / you;

  return (
    <TableCell>
      <span className="flex flex-col gap-1">
        <span className="numeric font-mono">{cell(you)}</span>
        <Meter value={Math.min(1, ratio) * 100} tone="health" />
        <span className="text-caption text-muted-foreground">
          {COMPARISON_LABEL[comparison(row)]}
        </span>
      </span>
    </TableCell>
  );
}

export function AuditBenchmarks({
  appId,
  benchmarks,
}: {
  appId: string;
  benchmarks: Benchmarks | null | undefined;
}) {
  if (!benchmarks || benchmarks.rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No competitors to compare with"
            body="Track a few rivals and the audit compares your listing with theirs."
            action={
              <Button asChild variant="outline">
                <Link href={`/apps/${appId}/competitors`}>Add competitors</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-3 text-lg font-medium">Competitor comparison</h2>
        <Table>
          <TableCaption>
            How your listing compares with {benchmarks.competitors} competitors
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>You</TableHead>
              <TableHead>Competitor median</TableHead>
              <TableHead>Best</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {benchmarks.rows.map((row) => (
              <TableRow key={row.metric}>
                <TableCell>{row.label}</TableCell>
                <YouCell row={row} />
                <TableCell className="numeric font-mono">
                  {cell(row.median)}
                </TableCell>
                <TableCell className="numeric font-mono">
                  {cell(row.best)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
