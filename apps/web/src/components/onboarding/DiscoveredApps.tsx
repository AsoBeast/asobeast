"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import type { CompetitorSuggestion, Store } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { apiErrorMessage } from "@/components/localizations/api-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { competitorSuggestionsOptions } from "@/lib/queries";
import {
  addButtonLabel,
  discoveredEmptyText,
  discoveredRows,
  suggestionMeta,
} from "./discovered-apps";
import { useAddCompetitors, type AddOutcome } from "./useAddCompetitors";

const NOTHING_TICKED: ReadonlySet<string> = new Set();

function withoutIds(
  current: ReadonlySet<string>,
  ids: readonly string[],
): ReadonlySet<string> {
  const next = new Set(current);
  for (const id of ids) next.delete(id);
  return next;
}
const ICON_SIZE = 24;

function OutcomeLine({ outcome }: { outcome: AddOutcome | undefined }) {
  if (!outcome) return null;
  return outcome.kind === "added" ? (
    <span role="status" className="text-caption text-muted-foreground">
      Added
    </span>
  ) : (
    <span role="status" className="text-caption text-destructive">
      {outcome.message}
    </span>
  );
}

function SuggestionRow({
  row,
  store,
  checkboxId,
  ticked,
  disabled,
  outcome,
  onToggle,
}: {
  row: CompetitorSuggestion;
  store: Store;
  checkboxId: string;
  ticked: boolean;
  disabled: boolean;
  outcome: AddOutcome | undefined;
  onToggle: (on: boolean) => void;
}) {
  return (
    <li className="flex min-h-11 items-center gap-3 py-1">
      <Checkbox
        id={checkboxId}
        checked={ticked}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <AppIcon src={row.iconUrl} size={ICON_SIZE} />
      <Label
        htmlFor={checkboxId}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
      >
        <span className="max-w-full truncate text-dense font-medium">
          {row.title}
        </span>
        <span className="numeric max-w-full truncate text-tick text-faint-foreground">
          {`${row.developer ?? "Unknown developer"} · ${suggestionMeta(row, store)}`}
        </span>
      </Label>
      <OutcomeLine outcome={outcome} />
    </li>
  );
}

function SuggestionsBody({
  appId,
  collecting,
  headingId,
}: {
  appId: string;
  collecting: boolean;
  headingId: string;
}) {
  const [ticked, setTicked] = useState(NOTHING_TICKED);
  const suggestions = useQuery(competitorSuggestionsOptions(appId));
  const { outcomes, run, adding } = useAddCompetitors(appId, (added) =>
    setTicked((current) => withoutIds(current, added)),
  );
  const rows = discoveredRows(suggestions.data);
  const selected = rows
    .map((row) => row.storeAppId)
    .filter((storeAppId) => ticked.has(storeAppId));
  const toggle = (storeAppId: string, on: boolean) =>
    setTicked((current) =>
      on
        ? new Set([...current, storeAppId])
        : withoutIds(current, [storeAppId]),
    );

  if (failedRead(suggestions)) {
    return (
      <InlineQueryError
        message={apiErrorMessage(
          suggestions.error,
          "Could not load suggested competitors.",
        )}
        read={suggestions}
      />
    );
  }
  if (!suggestions.data) return <Skeleton className="h-12 w-full" />;
  if (rows.length === 0) {
    return (
      <p className="text-dense text-muted-foreground">
        {discoveredEmptyText(collecting, suggestions.data.similar)}
      </p>
    );
  }
  return (
    <>
      <ul
        aria-labelledby={headingId}
        className="flex flex-col divide-y divide-border-subtle"
      >
        {rows.map((row) => {
          const outcome = outcomes[row.storeAppId];
          return (
            <SuggestionRow
              key={row.storeAppId}
              row={row}
              store={suggestions.data.store}
              checkboxId={`${headingId}-${row.storeAppId}`}
              ticked={ticked.has(row.storeAppId)}
              disabled={adding || outcome?.kind === "added"}
              outcome={outcome}
              onToggle={(on) => toggle(row.storeAppId, on)}
            />
          );
        })}
      </ul>
      <Button
        variant="outline"
        className="w-fit"
        aria-disabled={selected.length === 0 || adding || undefined}
        onClick={() => {
          if (selected.length > 0) run(selected);
        }}
      >
        {adding ? <Loader2 className="animate-spin" /> : <Plus />}
        {addButtonLabel(selected.length)}
      </Button>
    </>
  );
}

export function DiscoveredApps({
  appId,
  collecting,
}: {
  appId: string;
  collecting: boolean;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="text-dense font-medium">
        Suggested competitors
      </h4>
      <SuggestionsBody
        appId={appId}
        collecting={collecting}
        headingId={headingId}
      />
    </section>
  );
}
