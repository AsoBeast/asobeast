"use client";

import { useId, useState } from "react";
import {
  countChars,
  type LintIssue,
  type MetadataField,
} from "@asobeast/shared";
import { LintIssueRow } from "@/components/metadata/LintIssueRow";
import { Textarea } from "@/components/ui/textarea";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

export function MetadataFieldCard({
  field,
  value,
  limit,
  indexed,
  issues,
}: {
  field: MetadataField;
  value: string;
  limit: number;
  indexed: boolean;
  issues: LintIssue[];
}) {
  const countId = useId();
  const [draft, setDraft] = useState(value);
  const used = countChars(draft);
  const over = used > limit;
  const label = METADATA_FIELD_LABELS[field];

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card px-4 pt-3 pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-heading font-semibold text-foreground">
          <span>{label}</span>
          {indexed ? null : (
            <span className="text-caption font-normal text-faint-foreground">
              Not searched by the store
            </span>
          )}
        </h3>
        <span
          id={countId}
          aria-live="polite"
          className={cn(
            "numeric text-label",
            over ? "text-signal-down" : "text-faint-foreground",
          )}
        >
          {`${used}/${limit}${over ? ` · ${used - limit} over` : ""}`}
        </span>
      </div>

      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={field === "description" ? 4 : 2}
        aria-label={label}
        aria-describedby={countId}
        aria-invalid={over}
        dir="auto"
        className="resize-y"
      />

      {issues.length > 0 ? (
        <ul className="flex list-none flex-col gap-1 p-0">
          {issues.map((issue, index) => (
            <LintIssueRow key={`${issue.rule}-${index}`} issue={issue} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
