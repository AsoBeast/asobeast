"use client";

import { useId, type ReactNode } from "react";
import {
  STORE_FIELD_LIMITS,
  type LintIssue,
  type Store,
} from "@asobeast/shared";
import { LintIssueRow } from "@/components/metadata/LintIssueRow";
import { NotSearchedLabel } from "@/components/metadata/NotSearchedLabel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusClaim } from "@/lib/focus-handoff";
import { fieldCount, type ListingDraftField } from "@/lib/listing-draft";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import type { SearchWord } from "@/lib/store-preview/search-words";
import { cn } from "@/lib/utils";
import { groupLintIssues } from "./repeated-words";
import { SearchWordChips } from "./SearchWordChips";

const MULTILINE: ReadonlySet<ListingDraftField> = new Set([
  "promotionalText",
  "keywordField",
  "description",
]);

export const draftFieldFocusKey = (field: ListingDraftField): string =>
  `draft-field:${field}`;

export const draftFieldSelector = (field: ListingDraftField): string =>
  `[data-draft-field="${field}"]`;

function LiveValue({
  field,
  live,
  onRevert,
}: {
  field: ListingDraftField;
  live: string;
  onRevert: () => void;
}) {
  const label = METADATA_FIELD_LABELS[field].toLowerCase();
  const shown = live.trim() === "" ? "empty" : live;
  return (
    <p className="flex min-w-0 items-baseline gap-2 text-caption">
      {field === "description" ? (
        <span className="text-muted-foreground">
          Changed from the live listing
        </span>
      ) : (
        <>
          <span className="shrink-0 text-faint-foreground">Live</span>
          <span
            translate="no"
            dir="auto"
            title={live}
            className="min-w-0 truncate text-muted-foreground"
          >
            {shown}
          </span>
        </>
      )}
      <button
        type="button"
        aria-label={`Revert ${label} to the live listing`}
        onClick={onRevert}
        className="shrink-0 rounded-sm text-label text-muted-foreground link-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>Revert</span>
      </button>
    </p>
  );
}

export function DraftFieldInput({
  store,
  field,
  value,
  live,
  onChange,
  onRevert,
  readOnly = false,
  hideLabel = false,
  issues = [],
  words = null,
  action,
  children,
}: {
  store: Store;
  field: ListingDraftField;
  value: string;
  live: string;
  onChange: (value: string) => void;
  onRevert: () => void;
  readOnly?: boolean;
  hideLabel?: boolean;
  issues?: LintIssue[];
  words?: readonly SearchWord[] | null;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const inputId = useId();
  const countId = useId();
  const claimFocus = useFocusClaim(draftFieldFocusKey(field));
  const count = fieldCount(store, field, value);
  const searched = STORE_FIELD_LIMITS[store][field]?.indexed === true;
  const control = {
    ref: claimFocus,
    "data-draft-field": field,
    id: inputId,
    value,
    readOnly,
    dir: "auto",
    "aria-describedby": countId,
    "aria-invalid": count.over > 0,
    className: "scroll-mt-32 @4xl/metadata:scroll-mt-20",
  } as const;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <Label
            htmlFor={inputId}
            className={hideLabel ? "sr-only" : undefined}
          >
            {METADATA_FIELD_LABELS[field]}
          </Label>
          {searched ? null : <NotSearchedLabel field={field} />}
        </div>
        <div className="flex items-center gap-1">
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
          {action}
        </div>
      </div>
      {MULTILINE.has(field) ? (
        <Textarea
          {...control}
          rows={field === "description" ? 8 : 3}
          className={cn(control.className, "resize-y")}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...control}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {value === live || readOnly ? null : (
        <LiveValue field={field} live={live} onRevert={onRevert} />
      )}
      {issues.length > 0 ? (
        <ul className="flex list-none flex-col gap-1 p-0">
          {groupLintIssues(issues).map((issue, index) => (
            <LintIssueRow
              key={`${issue.rule}-${index}`}
              issue={issue}
              showRule={false}
            />
          ))}
        </ul>
      ) : null}
      {words ? (
        <SearchWordChips
          label={`Words search reads in the ${METADATA_FIELD_LABELS[field].toLowerCase()}`}
          words={words}
        />
      ) : null}
      {children}
    </div>
  );
}
