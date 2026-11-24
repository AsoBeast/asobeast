"use client";

import { useId, type ReactNode } from "react";
import {
  STORE_FIELD_LIMITS,
  type LintIssue,
  type Store,
} from "@asobeast/shared";
import { LintIssueRow } from "@/components/metadata/LintIssueRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldCount, type ListingDraftField } from "@/lib/listing-draft";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

const MULTILINE: ReadonlySet<ListingDraftField> = new Set([
  "keywordField",
  "description",
]);

export function DraftFieldInput({
  store,
  field,
  value,
  onChange,
  readOnly = false,
  issues = [],
  children,
}: {
  store: Store;
  field: ListingDraftField;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  issues?: LintIssue[];
  children?: ReactNode;
}) {
  const inputId = useId();
  const countId = useId();
  const count = fieldCount(store, field, value);
  const searched = STORE_FIELD_LIMITS[store][field]?.indexed === true;
  const control = {
    id: inputId,
    value,
    readOnly,
    dir: "auto",
    "aria-describedby": countId,
    "aria-invalid": count.over > 0,
  } as const;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <Label htmlFor={inputId}>{METADATA_FIELD_LABELS[field]}</Label>
          {searched ? null : (
            <span className="text-caption text-faint-foreground">
              Not searched by the store
            </span>
          )}
        </div>
        <span
          id={countId}
          aria-live="polite"
          className={cn(
            "numeric text-label",
            count.over > 0 ? "text-signal-down" : "text-faint-foreground",
          )}
        >
          {count.text}
        </span>
      </div>
      {MULTILINE.has(field) ? (
        <Textarea
          {...control}
          rows={field === "description" ? 8 : 3}
          className="resize-y"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...control}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {issues.length > 0 ? (
        <ul className="flex list-none flex-col gap-1 p-0">
          {issues.map((issue, index) => (
            <LintIssueRow key={`${issue.rule}-${index}`} issue={issue} />
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}
