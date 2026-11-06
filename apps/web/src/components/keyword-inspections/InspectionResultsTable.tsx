"use client";

import { useState } from "react";
import type { KeywordInspectionResult } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompact, formatNumber, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TITLE_MATCH_LABELS } from "./inspection-format";

const COLLAPSED_COUNT = 10;

const MATCH_VARIANTS = {
  exact: "info",
  allWords: "secondary",
  someWords: "outline",
  none: "ghost",
} as const;

export function InspectionResultsTable({
  keyword,
  results,
  entered,
}: {
  keyword: string;
  results: KeywordInspectionResult[];
  entered: readonly string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? results : results.slice(0, COLLAPSED_COUNT);
  const newcomers = new Set(entered);
  return (
    <div className="flex flex-col gap-2">
      <Table scrollLabel="Search results" scrollFocus="overflow">
        <TableCaption className="sr-only">
          The top {shown.length} results for “{keyword}”, in store order
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 pr-0 text-right">#</TableHead>
            <TableHead>App</TableHead>
            <TableHead className="text-right">Ratings</TableHead>
            <TableHead className="hidden sm:table-cell">Title match</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((result) => {
            const isNew = result.position <= 10 && newcomers.has(result.title);
            return (
              <TableRow
                key={`${result.position}-${result.storeAppId}`}
                className={cn(isNew && "bg-success-subtle/60")}
              >
                <TableCell className="numeric pr-0 text-right font-mono text-muted-foreground">
                  {result.position}
                </TableCell>
                <TableCell className="max-w-0 w-full">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AppIcon
                      src={result.iconUrl}
                      name={result.title}
                      size={28}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {result.title}
                      </span>
                      <Badge
                        variant={MATCH_VARIANTS[result.titleMatch]}
                        className="mt-0.5 sm:hidden"
                      >
                        {TITLE_MATCH_LABELS[result.titleMatch]}
                      </Badge>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {isNew ? (
                          <Badge variant="success" className="shrink-0">
                            New<span className="sr-only"> in the top 10</span>
                          </Badge>
                        ) : null}
                        <span className="truncate">
                          {[
                            result.developer,
                            result.ratingAvg === null
                              ? null
                              : `${formatRating(result.ratingAvg)} rating`,
                          ]
                            .filter((part) => part !== null)
                            .join(" · ")}
                        </span>
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="numeric text-right font-mono">
                  {result.ratingCount === null
                    ? "—"
                    : formatCompact(result.ratingCount)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={MATCH_VARIANTS[result.titleMatch]}>
                    {TITLE_MATCH_LABELS[result.titleMatch]}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {results.length > COLLAPSED_COUNT ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded
            ? "Show the top 10"
            : `Show all ${formatNumber(results.length)} results`}
        </Button>
      ) : null}
    </div>
  );
}
