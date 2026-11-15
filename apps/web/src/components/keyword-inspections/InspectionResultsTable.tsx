"use client";

import { useState } from "react";
import type {
  KeywordInspectionApp,
  KeywordInspectionResult,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { MatchedText } from "@/components/keyword-match/MatchedText";
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
import { formatCompact, formatNumber } from "@/lib/format";
import { sinceUpdate, TITLE_MATCH_LABELS } from "./inspection-format";

const COLLAPSED_COUNT = 10;

function ResultName({
  result,
  isNew,
  at,
}: {
  result: KeywordInspectionResult;
  isNew: boolean;
  at: string;
}) {
  const line = [result.developer, sinceUpdate(result.updatedAt, at)]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AppIcon src={result.iconUrl} size={24} />
      <div className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span translate="no" dir="auto" className="truncate font-medium">
            <MatchedText
              segments={result.titleSegments}
              fallback={result.title}
            />
          </span>
          {isNew ? (
            <span className="shrink-0 text-label text-signal-up">
              <span>New</span>
              <span className="sr-only"> in the top 10</span>
            </span>
          ) : null}
        </span>
        {line === "" ? null : (
          <span
            title={line}
            className="truncate text-caption text-faint-foreground"
          >
            {line}
          </span>
        )}
      </div>
    </div>
  );
}

export function InspectionResultsTable({
  keyword,
  results,
  entered,
  at,
}: {
  keyword: string;
  results: KeywordInspectionResult[];
  entered: readonly KeywordInspectionApp[];
  at: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? results : results.slice(0, COLLAPSED_COUNT);
  const newcomers = new Set(entered.map((app) => app.storeAppId));
  return (
    <div className="flex flex-col">
      <Table scrollLabel="Search results" scrollFocus="overflow">
        <TableCaption className="sr-only">
          {`The top ${shown.length} results for “${keyword}”, in store order`}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pr-0 text-right">#</TableHead>
            <TableHead className="md:pr-2">App</TableHead>
            <TableHead className="hidden w-26 md:px-2 sm:table-cell">
              Title match
            </TableHead>
            <TableHead className="w-20 text-right md:pl-2">Ratings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((result) => (
            <TableRow key={`${result.position}-${result.storeAppId}`}>
              <TableCell className="numeric pr-0 text-right text-faint-foreground">
                {result.position}
              </TableCell>
              <TableCell className="w-full max-w-0 md:pr-2">
                <ResultName
                  result={result}
                  isNew={newcomers.has(result.storeAppId)}
                  at={at}
                />
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell md:px-2">
                {TITLE_MATCH_LABELS[result.titleMatch]}
              </TableCell>
              <TableCell className="numeric text-right md:pl-2">
                {result.ratingCount === null
                  ? "—"
                  : formatCompact(result.ratingCount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {results.length > COLLAPSED_COUNT ? (
        <div className="border-t border-border-subtle p-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded
              ? "Show the top 10"
              : `Show all ${formatNumber(results.length)} results`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
