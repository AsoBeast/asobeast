"use client";

import { useId } from "react";
import { Check, Loader2, Plus, RotateCw } from "lucide-react";
import type {
  KeywordSuggestion,
  KeywordSuggestionStrategy,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { EMPTY_COPY, USED_BY_NOUN } from "./suggestion-strategies";

function SuggestionMeta({ suggestion }: { suggestion: KeywordSuggestion }) {
  const noun = USED_BY_NOUN[suggestion.strategy] ?? "app";
  return (
    <span className="flex items-center gap-2 text-caption text-muted-foreground">
      {suggestion.usedByCount !== undefined ? (
        <span className="numeric font-mono">
          {suggestion.usedByCount} {noun}
          {suggestion.usedByCount === 1 ? "" : "s"}
        </span>
      ) : null}
      {suggestion.priority !== undefined ? (
        <span className="numeric font-mono">
          priority {Math.round(suggestion.priority)}
        </span>
      ) : null}
      {suggestion.event ? (
        <Badge variant="secondary">{suggestion.event}</Badge>
      ) : null}
    </span>
  );
}

export type SuggestionAction =
  | {
      kind: "track";
      pendingText: string | undefined;
      onTrack: (text: string) => void;
    }
  | {
      kind: "select";
      selected: ReadonlySet<string>;
      onToggle: (text: string, selected: boolean) => void;
    };

export type SuggestionListState =
  | { status: "pending" }
  | { status: "error"; error: unknown }
  | { status: "ready"; suggestions: KeywordSuggestion[] };

export function suggestionListState(query: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: KeywordSuggestion[] | undefined;
}): SuggestionListState {
  if (query.isError) return { status: "error", error: query.error };
  if (query.isPending || !query.data) return { status: "pending" };
  return { status: "ready", suggestions: query.data };
}

function TrackAction({
  text,
  already,
  pendingText,
  onTrack,
}: {
  text: string;
  already: boolean;
  pendingText: string | undefined;
  onTrack: (text: string) => void;
}) {
  const pending = pendingText === text;
  return (
    <Button
      variant={already ? "ghost" : "outline"}
      size="sm"
      disabled={already || pending}
      onClick={() => onTrack(text)}
    >
      {already ? (
        <>
          <Check />
          Tracked
        </>
      ) : pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <>
          <Plus />
          Track
        </>
      )}
    </Button>
  );
}

export function SuggestionList({
  strategy,
  state,
  trackedTexts,
  action,
  onRetry,
}: {
  strategy: KeywordSuggestionStrategy;
  state: SuggestionListState;
  trackedTexts: ReadonlySet<string>;
  action: SuggestionAction;
  onRetry: () => void;
}) {
  const idPrefix = useId();

  if (state.status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4 text-body text-muted-foreground">
        <span>
          {state.error instanceof ApiError
            ? state.error.envelope.message
            : "Could not load suggestions."}
        </span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          Retry
        </Button>
      </div>
    );
  }

  if (state.suggestions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-body text-muted-foreground">
        {EMPTY_COPY[strategy] ??
          "No new suggestions from this source right now."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {state.suggestions.map((suggestion, index) => {
        const already = trackedTexts.has(suggestion.text);
        if (action.kind === "select") {
          const checkboxId = `${idPrefix}-${index}`;
          return (
            <li key={suggestion.text} className="flex items-center gap-3 py-2">
              <Checkbox
                id={checkboxId}
                checked={already || action.selected.has(suggestion.text)}
                disabled={already}
                onCheckedChange={(checked) =>
                  action.onToggle(suggestion.text, checked === true)
                }
              />
              <Label
                htmlFor={checkboxId}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
              >
                <span className="truncate text-body font-medium">
                  {suggestion.text}
                </span>
                <SuggestionMeta suggestion={suggestion} />
              </Label>
              {already ? <Badge variant="outline">Tracked</Badge> : null}
            </li>
          );
        }
        return (
          <li
            key={suggestion.text}
            className="flex items-center justify-between gap-4 py-2"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-medium">
                {suggestion.text}
              </span>
              <SuggestionMeta suggestion={suggestion} />
            </div>
            <TrackAction
              text={suggestion.text}
              already={already}
              pendingText={action.pendingText}
              onTrack={action.onTrack}
            />
          </li>
        );
      })}
    </ul>
  );
}
