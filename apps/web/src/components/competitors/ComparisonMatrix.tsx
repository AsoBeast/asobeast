"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { comparisonOptions, competitorsOptions } from "@/lib/queries";
import { onlyGapsParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { positionBand } from "./position-band";

function bestPosition(
  row: KeywordComparisonRow,
  competitorIds: string[],
): number | null {
  const values = [
    row.you,
    ...competitorIds.map((cid) => row.positions[cid] ?? null),
  ];
  const found = values.filter((value): value is number => value !== null);
  return found.length > 0 ? Math.min(...found) : null;
}

function PositionCell({
  value,
  best,
}: {
  value: number | null;
  best: boolean;
}) {
  const band = positionBand(value);
  return (
    <span
      title={band ? `Position ${value} — ${band.label}` : "Not ranking"}
      style={
        band
          ? {
              backgroundColor: `color-mix(in oklch, ${band.token} 22%, transparent)`,
            }
          : undefined
      }
      className={cn(
        "numeric font-mono inline-flex min-w-10 justify-center rounded-md px-1.5 py-0.5",
        value === null && "text-muted-foreground",
        best && "font-semibold underline decoration-2 underline-offset-4",
      )}
    >
      {formatRankPosition(value)}
    </span>
  );
}

function subScore(value: number | null): string {
  return value === null ? "—" : String(Math.round(value * 10));
}

export function ComparisonMatrix({ id }: { id: string }) {
  const [onlyGaps, setOnlyGaps] = useQueryState("onlyGaps", onlyGapsParser);
  const { data } = useSuspenseQuery(comparisonOptions(id, onlyGaps));
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));

  const icons = new Map(competitors.map((item) => [item.id, item.iconUrl]));

  return (
    <Card>
      <CardHeader>
        <CardDescription>Comparison matrix</CardDescription>
        <CardTitle>Your position against every competitor</CardTitle>
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id="only-gaps"
            checked={onlyGaps}
            onCheckedChange={(next) => setOnlyGaps(next ? true : null)}
          />
          <Label htmlFor="only-gaps" className="text-sm text-muted-foreground">
            only gaps
          </Label>
        </div>
      </CardHeader>
      <CardContent>
        {data.competitors.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add a competitor above to discover keyword gaps — phrases they rank
            for and you do not. One search serves every app, so this costs no
            extra scraping.
          </div>
        ) : data.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {onlyGaps
              ? "No gaps — you rank everywhere your competitors do."
              : "No comparison data yet. Track keywords and run a daily check to populate positions."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableCaption className="sr-only">
                Your keyword positions compared with each tracked competitor.
                Gap rows are keywords a competitor ranks for and you do not.
              </TableCaption>
              <TableHeader>
                <TableRow className="bg-card">
                  <TableHead className="sticky left-0 z-20 bg-inherit">
                    Keyword
                  </TableHead>
                  <TableHead className="border-x bg-secondary text-center">
                    You
                  </TableHead>
                  {data.competitors.map((competitor) => (
                    <TableHead key={competitor.id} className="text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <AppIcon
                          src={icons.get(competitor.id) ?? null}
                          name={competitor.name}
                          size={20}
                        />
                        <span className="max-w-32 truncate">
                          {competitor.name ?? "Competitor"}
                        </span>
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => {
                  const best = bestPosition(
                    row,
                    data.competitors.map((competitor) => competitor.id),
                  );
                  return (
                    <TableRow
                      key={row.keywordId}
                      className={cn(row.gap ? "bg-warning-subtle" : "bg-card")}
                    >
                      <TableCell className="sticky left-0 z-10 bg-inherit">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            {row.text}
                            {row.gap ? (
                              <Badge
                                variant="outline"
                                className="border-warning/40 text-warning"
                              >
                                Gap
                              </Badge>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground numeric font-mono">
                            T {subScore(row.traffic)} · D{" "}
                            {subScore(row.difficulty)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="border-x bg-secondary/40 text-center">
                        <PositionCell
                          value={row.you}
                          best={best !== null && row.you === best}
                        />
                      </TableCell>
                      {data.competitors.map((competitor) => {
                        const value = row.positions[competitor.id] ?? null;
                        return (
                          <TableCell
                            key={competitor.id}
                            className="text-center"
                          >
                            <PositionCell
                              value={value}
                              best={best !== null && value === best}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
