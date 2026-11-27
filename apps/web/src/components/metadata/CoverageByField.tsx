"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { KeywordCoverageRow } from "@asobeast/shared";
import { BucketLabel } from "@/components/BucketBadge";
import {
  FOOTER_LINK,
  LIST_HEAD,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumberInLocale } from "@/lib/format";
import { metadataFieldLabel } from "@/lib/metadata-display";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import {
  coverageByField,
  screenshotTextCovered,
  uncoveredRows,
} from "./coverage-summary";
import { ShareTrack } from "./ShareTrack";
import { useShowUncovered } from "./use-show-uncovered";

const FIELD_ROW =
  "grid min-h-7 grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-3";
const MISSING_SHOWN = 5;

function FieldRow({
  label,
  covered,
  total,
  weak = false,
}: {
  label: string;
  covered: number;
  total: number;
  weak?: boolean;
}) {
  const t = useTranslations("metadata");
  const locale = useAppLocale();
  return (
    <div className={FIELD_ROW}>
      <dt
        className={cn(
          "truncate text-dense",
          weak ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {label}
      </dt>
      <dd className="contents">
        <ShareTrack share={total === 0 ? 0 : covered / total} />
        <span className="numeric text-right text-dense">
          <span className="font-semibold">
            {formatNumberInLocale(covered, locale)}
          </span>
          <span className="text-muted-foreground">
            {t("coverage.fieldShareRest", { total })}
          </span>
        </span>
      </dd>
    </div>
  );
}

function MissingKeywords({ rows }: { rows: KeywordCoverageRow[] }) {
  const t = useTranslations("metadata");
  const locale = useAppLocale();
  const headingId = useId();
  const hidden = rows.length - MISSING_SHOWN;
  return (
    <div className="flex flex-col gap-1 border-t border-border-subtle px-2 pt-3">
      <h3 id={headingId} className={cn(LIST_HEAD, "flex items-center gap-2")}>
        <span className="text-foreground">{t("coverage.notInListing")}</span>
        <span className="numeric font-normal">
          {formatNumberInLocale(rows.length, locale)}
        </span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          {t("coverage.everyKeywordPresent")}
        </p>
      ) : (
        <ul aria-labelledby={headingId} className="flex list-none flex-col p-0">
          {rows.slice(0, MISSING_SHOWN).map((row) => (
            <li
              key={row.keywordId}
              className="flex min-h-9 items-center justify-between gap-3 text-dense"
            >
              <span
                translate="no"
                dir="auto"
                title={row.text}
                className="truncate font-medium"
              >
                {row.text}
              </span>
              {row.bucket ? (
                <span className="shrink-0 text-caption text-faint-foreground">
                  <BucketLabel bucket={row.bucket} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <p className="text-caption text-faint-foreground">
          {t("coverage.moreInTable", { count: hidden })}
        </p>
      ) : null}
    </div>
  );
}

export function CoverageByField({
  rows,
  withScreenshotText,
  className,
}: {
  rows: KeywordCoverageRow[];
  withScreenshotText: boolean;
  className?: string;
}) {
  const t = useTranslations("metadata");
  const headingId = useId();
  const showUncovered = useShowUncovered();
  const missing = uncoveredRows(rows);

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>{t("coverage.byField")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-2">
          <dl
            aria-label={t("coverage.trackedFound")}
            className="flex flex-col gap-1 px-2"
          >
            {coverageByField(rows).map(({ field, covered }) => (
              <FieldRow
                key={field}
                label={metadataFieldLabel(field, t)}
                covered={covered}
                total={rows.length}
              />
            ))}
            {withScreenshotText ? (
              <FieldRow
                label={t("coverage.screenshotTextLabel")}
                covered={screenshotTextCovered(rows)}
                total={rows.length}
                weak
              />
            ) : null}
          </dl>
          <MissingKeywords rows={missing} />
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-y-1">
          <span>{t("coverage.trackedKeywords", { count: rows.length })}</span>
          {missing.length > 0 ? (
            <button
              type="button"
              onClick={showUncovered}
              className={cn(
                FOOTER_LINK,
                "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span>{t("coverage.showUncovered")}</span>
            </button>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
