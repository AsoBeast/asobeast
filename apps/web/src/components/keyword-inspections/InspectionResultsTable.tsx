"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { formatCompactInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { sinceUpdate, titleMatchLabel } from "./inspection-format";

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
  const t = useTranslations("keywordInspector");
  const line = [result.developer, sinceUpdate(result.updatedAt, at, t)]
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
              <span>{t("inspector.results.new")}</span>
              <span className="sr-only">
                {t("inspector.results.newInTop10")}
              </span>
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
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const shown = expanded ? results : results.slice(0, COLLAPSED_COUNT);
  const newcomers = new Set(entered.map((app) => app.storeAppId));
  return (
    <div className="flex flex-col">
      <Table
        scrollLabel={t("inspector.results.scrollLabel")}
        scrollFocus="overflow"
      >
        <TableCaption className="sr-only">
          {t("inspector.results.caption", {
            count: shown.length,
            keyword,
          })}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pr-0 text-right">
              {t("inspector.results.rank")}
            </TableHead>
            <TableHead className="md:pr-2">
              {t("inspector.results.app")}
            </TableHead>
            <TableHead className="hidden w-26 md:px-2 sm:table-cell">
              {t("inspector.results.titleMatch")}
            </TableHead>
            <TableHead className="w-20 text-right md:pl-2">
              {t("inspector.results.ratings")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((result) => (
            <TableRow key={`${result.position}-${result.storeAppId}`}>
              <TableCell className="numeric pr-0 text-right text-faint-foreground">
                <span>{result.position}</span>
              </TableCell>
              <TableCell className="w-full max-w-0 md:pr-2">
                <ResultName
                  result={result}
                  isNew={newcomers.has(result.storeAppId)}
                  at={at}
                />
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell md:px-2">
                <span>{titleMatchLabel(result.titleMatch, t)}</span>
              </TableCell>
              <TableCell className="numeric text-right md:pl-2">
                <span>
                  {result.ratingCount === null
                    ? "—"
                    : formatCompactInLocale(result.ratingCount, locale)}
                </span>
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
              ? t("inspector.results.showTop10")
              : t("inspector.results.showAll", {
                  count: results.length,
                })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
