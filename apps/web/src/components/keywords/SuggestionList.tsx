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
    <span className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
      {suggestion.seed ? (
        <span className="wrap-anywhere">from “{suggestion.seed}”</span>
      ) : null}
      {suggestion.usedByCount !== undefined ? (
        <span className="numeric">
          {suggestion.usedByCount} {noun}
          {suggestion.usedByCount === 1 ? "" : "s"}
        </span>
      ) : null}
      {suggestion.event ? (
        <Badge variant="secondary">{suggestion.event}</Badge>
      ) : null}
    </span>
  );
}

interface TrackHandlers {
  pending: ReadonlySet<string>;
  onTrack: (text: string) => void;
}

interface SelectHandlers {
  selected: ReadonlySet<string>;
  onToggle: (text: string, selected: boolean) => void;
}

export type SuggestionAction =
  | ({ kind: "track" } & TrackHandlers)
  | ({ kind: "select" } & SelectHandlers)
  | ({ kind: "trackOrSelect" } & TrackHandlers & SelectHandlers);

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

function SuggestionText({ suggestion }: { suggestion: KeywordSuggestion }) {
  return (
    <>
      <span className="truncate text-body font-medium">{suggestion.text}</span>
      <SuggestionMeta suggestion={suggestion} />
    </>
  );
}

function SuggestionTick({
  id,
  suggestion,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  suggestion: KeywordSuggestion;
  checked: boolean;
  disabled?: boolean;
  onToggle: (text: string, selected: boolean) => void;
}) {
  return (
    <>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onToggle(suggestion.text, value === true)}
      />
      <Label
        htmlFor={id}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
      >
        <SuggestionText suggestion={suggestion} />
      </Label>
    </>
  );
}

function TrackAction({
  text,
  already,
  pending,
  onTrack,
}: {
  text: string;
  already: boolean;
  pending: boolean;
  onTrack: (text: string) => void;
}) {
  const inert = already || pending;
  return (
    <Button
      variant={already ? "ghost" : "outline"}
      size="sm"
      aria-label={already ? `${text} is tracked` : `Track ${text}`}
      aria-disabled={inert || undefined}
      aria-busy={(pending && !already) || undefined}
      onClick={() => {
        if (!inert) onTrack(text);
      }}
    >
      {already ? (
        <>
          <Check />
          Tracked
        </>
      ) : (
        <>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
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
      <div className="flex flex-wrap items-center gap-4 text-body text-muted-foreground">
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
      <p className="max-w-prose text-body text-muted-foreground">
        {EMPTY_COPY[strategy] ??
          "No new suggestions from this source right now."}
      </p>
    );
  }

  return (
    <div className="@container">
      <ul className="grid gap-x-8 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {state.suggestions.map((suggestion, index) => {
          const { text } = suggestion;
          const already = trackedTexts.has(text);
          const tickId = `${idPrefix}-${index}`;
          if (action.kind === "select") {
            return (
              <li
                key={text}
                className="flex items-center gap-3 border-b border-border-subtle py-2"
              >
                <SuggestionTick
                  id={tickId}
                  suggestion={suggestion}
                  checked={already || action.selected.has(text)}
                  disabled={already}
                  onToggle={action.onToggle}
                />
                {already ? <Badge variant="outline">Tracked</Badge> : null}
              </li>
            );
          }
          const track = (
            <TrackAction
              text={text}
              already={already}
              pending={action.pending.has(text)}
              onTrack={action.onTrack}
            />
          );
          if (action.kind === "trackOrSelect") {
            return (
              <li
                key={text}
                className="flex items-center gap-3 border-b border-border-subtle py-2"
              >
                {already ? (
                  <>
                    <span aria-hidden className="size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <SuggestionText suggestion={suggestion} />
                    </div>
                  </>
                ) : (
                  <SuggestionTick
                    id={tickId}
                    suggestion={suggestion}
                    checked={action.selected.has(text)}
                    onToggle={action.onToggle}
                  />
                )}
                {track}
              </li>
            );
          }
          return (
            <li
              key={text}
              className="flex items-center justify-between gap-4 border-b border-border-subtle py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <SuggestionText suggestion={suggestion} />
              </div>
              {track}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
