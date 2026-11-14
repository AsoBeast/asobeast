"use client";

import { useId } from "react";
import type { KeywordCoverageRow } from "@asobeast/shared";
import { BUCKET_LABELS } from "@/components/BucketBadge";
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
import { formatNumber, pluralize } from "@/lib/format";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
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
          <span className="font-semibold">{formatNumber(covered)}</span>
          <span className="text-muted-foreground">{` of ${formatNumber(total)}`}</span>
        </span>
      </dd>
    </div>
  );
}

function MissingKeywords({ rows }: { rows: KeywordCoverageRow[] }) {
  const headingId = useId();
  const hidden = rows.length - MISSING_SHOWN;
  return (
    <div className="flex flex-col gap-1 border-t border-border-subtle px-2 pt-3">
      <h3 id={headingId} className={cn(LIST_HEAD, "flex items-center gap-2")}>
        <span className="text-foreground">Not in this listing</span>
        <span className="numeric font-normal">{formatNumber(rows.length)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          Every tracked keyword is in this listing.
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
                  {BUCKET_LABELS[row.bucket]}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <p className="text-caption text-faint-foreground">
          {`${formatNumber(hidden)} more in the table`}
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
  const headingId = useId();
  const showUncovered = useShowUncovered();
  const missing = uncoveredRows(rows);

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Coverage by field</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-2">
          <dl
            aria-label="Tracked keywords found in each field"
            className="flex flex-col gap-1 px-2"
          >
            {coverageByField(rows).map(({ field, covered }) => (
              <FieldRow
                key={field}
                label={METADATA_FIELD_LABELS[field]}
                covered={covered}
                total={rows.length}
              />
            ))}
            {withScreenshotText ? (
              <FieldRow
                label="Screenshot text"
                covered={screenshotTextCovered(rows)}
                total={rows.length}
                weak
              />
            ) : null}
          </dl>
          <MissingKeywords rows={missing} />
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-y-1">
          <span>{pluralize(rows.length, "tracked keyword")}</span>
          {missing.length > 0 ? (
            <button
              type="button"
              onClick={showUncovered}
              className={cn(
                FOOTER_LINK,
                "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span>Show uncovered</span>
            </button>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
