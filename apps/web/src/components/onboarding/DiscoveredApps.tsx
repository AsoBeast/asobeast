"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { CompetitorSuggestion, Store } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
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
const ICON_SIZE = 32;

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
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <Checkbox
        id={checkboxId}
        checked={ticked}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <AppIcon src={row.iconUrl} name={row.title} size={ICON_SIZE} />
      <Label
        htmlFor={checkboxId}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
      >
        <span className="truncate text-sm font-medium">{row.title}</span>
        <span className="truncate text-caption text-muted-foreground">
          {row.developer ?? "Unknown developer"}
        </span>
        <span className="numeric font-mono text-caption text-muted-foreground">
          {suggestionMeta(row, store)}
        </span>
      </Label>
      <OutcomeLine outcome={outcome} />
    </li>
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
  const [ticked, setTicked] = useState(NOTHING_TICKED);
  const suggestions = useQuery(competitorSuggestionsOptions(appId));
  const { outcomes, run, adding } = useAddCompetitors(appId, () =>
    setTicked(NOTHING_TICKED),
  );
  const rows = discoveredRows(suggestions.data);
  const toggle = (storeAppId: string, on: boolean) =>
    setTicked((current) => {
      const next = new Set(current);
      if (on) next.add(storeAppId);
      else next.delete(storeAppId);
      return next;
    });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="text-sm font-medium">
        Suggested competitors
      </h4>
      {suggestions.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span role="alert">
            {apiErrorMessage(
              suggestions.error,
              "Could not load suggested competitors.",
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void suggestions.refetch()}
          >
            <RefreshCw />
            Retry
          </Button>
        </div>
      ) : !suggestions.data ? (
        <Skeleton className="h-12 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {discoveredEmptyText(collecting, suggestions.data.similar)}
        </p>
      ) : (
        <>
          <ul aria-labelledby={headingId} className="flex flex-col divide-y">
            {rows.map((row) => (
              <SuggestionRow
                key={row.storeAppId}
                row={row}
                store={suggestions.data.store}
                checkboxId={`${headingId}-${row.storeAppId}`}
                ticked={ticked.has(row.storeAppId)}
                disabled={adding}
                outcome={outcomes[row.storeAppId]}
                onToggle={(on) => toggle(row.storeAppId, on)}
              />
            ))}
          </ul>
          <Button
            className="w-fit"
            disabled={ticked.size === 0 || adding}
            onClick={() => run([...ticked])}
          >
            {adding ? <Loader2 className="animate-spin" /> : <Plus />}
            {addButtonLabel(ticked.size)}
          </Button>
        </>
      )}
    </section>
  );
}
