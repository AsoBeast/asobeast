"use client";

import { Check, Loader2, Plus, RotateCw } from "lucide-react";
import type {
  KeywordSuggestion,
  KeywordSuggestionStrategy,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function SuggestionList({
  strategy,
  state,
  trackedTexts,
  pendingText,
  onTrack,
  onRetry,
}: {
  strategy: KeywordSuggestionStrategy;
  state:
    | { status: "pending" }
    | { status: "error"; error: unknown }
    | { status: "ready"; suggestions: KeywordSuggestion[] };
  trackedTexts: Set<string>;
  pendingText: string | undefined;
  onTrack: (text: string) => void;
  onRetry: () => void;
}) {
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
      {state.suggestions.map((suggestion) => {
        const already = trackedTexts.has(suggestion.text);
        const pending = pendingText === suggestion.text;
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
            <Button
              variant={already ? "ghost" : "outline"}
              size="sm"
              disabled={already || pending}
              onClick={() => onTrack(suggestion.text)}
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
          </li>
        );
      })}
    </ul>
  );
}
