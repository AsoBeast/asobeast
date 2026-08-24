"use client";

import { useId, useState } from "react";
import { type LintIssue, type MetadataField } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
import { Textarea } from "@/components/ui/textarea";
import {
  LINT_SEVERITY_LABEL,
  LINT_SEVERITY_VARIANT,
  METADATA_FIELD_LABELS,
} from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

export function MetadataFieldCard({
  field,
  value,
  limit,
  issues,
}: {
  field: MetadataField;
  value: string;
  limit: number;
  issues: LintIssue[];
}) {
  const countId = useId();
  const [draft, setDraft] = useState(value);
  const over = draft.length > limit;
  const label = METADATA_FIELD_LABELS[field];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{label}</span>
        <span
          id={countId}
          aria-live="polite"
          className={cn(
            "numeric font-mono text-body",
            over ? "font-semibold text-signal-down" : "text-muted-foreground",
          )}
        >
          {draft.length}/{limit}
          {over ? ` · ${draft.length - limit} over` : ""}
        </span>
      </div>

      <Meter
        value={Math.min(draft.length, limit)}
        max={limit}
        tone={over ? "neutral" : "score"}
        className={over ? "bg-signal-down-subtle" : undefined}
      />

      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={field === "description" ? 4 : 2}
        aria-label={label}
        aria-describedby={countId}
        aria-invalid={over}
        className="resize-y"
      />

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue, index) => (
            <li
              key={`${issue.rule}-${index}`}
              className="flex items-center gap-2 text-body text-muted-foreground"
            >
              <Badge variant={LINT_SEVERITY_VARIANT[issue.severity]}>
                {LINT_SEVERITY_LABEL[issue.severity]} · {issue.rule}
              </Badge>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-success">No issues.</p>
      )}
    </div>
  );
}
