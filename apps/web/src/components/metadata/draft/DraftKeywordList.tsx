"use client";

import { useId, useState } from "react";
import type { CoveragePreviewKeyword } from "@asobeast/shared";
import { LIST_HEAD } from "@/components/layout/panel-classes";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { formatCountry, formatList, formatNumber } from "@/lib/format";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

export type KeywordListTone = "down" | "up" | "plain";

const TONE_TEXT: Record<KeywordListTone, string> = {
  down: "text-signal-down",
  up: "text-signal-up",
  plain: "text-foreground",
};

function coveringFields(keyword: CoveragePreviewKeyword): string {
  const verdict = keyword.change === "lost" ? keyword.live : keyword.draft;
  const fields = verdict.fields
    .filter((field) => field.covered)
    .map((field) => METADATA_FIELD_LABELS[field.field]);
  if (fields.length > 0) return formatList(fields);
  return verdict.wordsSplit ? "Words split" : "";
}

export function DraftKeywordList({
  title,
  rows,
  shown,
  showCountry,
  tone = "plain",
}: {
  title: string;
  rows: CoveragePreviewKeyword[];
  shown: number;
  showCountry: boolean;
  tone?: KeywordListTone;
}) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, shown);

  return (
    <div className="flex flex-col gap-1 border-t border-border-subtle px-2 pt-3 first:border-t-0 first:pt-0">
      <h3 id={headingId} className={cn(LIST_HEAD, "flex items-center gap-2")}>
        {tone === "plain" ? null : (
          <DirectionArrow way={tone} className={TONE_TEXT[tone]} />
        )}
        <span className={TONE_TEXT[tone]}>{title}</span>
        <span className="numeric font-normal">{formatNumber(rows.length)}</span>
      </h3>
      {visible.length > 0 ? (
        <ul aria-labelledby={headingId} className="flex list-none flex-col p-0">
          {visible.map((row) => (
            <li
              key={`${row.keywordId}:${row.country}`}
              className="flex min-h-9 items-center justify-between gap-3 text-dense"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  translate="no"
                  dir="auto"
                  title={row.text}
                  className="truncate font-medium"
                >
                  {row.text}
                </span>
                {showCountry ? (
                  <span className="shrink-0 text-caption text-faint-foreground">
                    {formatCountry(row.country)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-caption text-faint-foreground">
                {coveringFields(row)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {rows.length > shown ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Show fewer" : `Show all ${formatNumber(rows.length)}`} ${title.toLowerCase()}`}
          onClick={() => setExpanded((open) => !open)}
          className="w-fit rounded-sm text-label text-muted-foreground link-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            {expanded ? "Show fewer" : `Show all ${formatNumber(rows.length)}`}
          </span>
        </button>
      ) : null}
    </div>
  );
}
