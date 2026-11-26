"use client";

import { useId, useRef, type Ref } from "react";
import { useTranslations } from "next-intl";
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
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { suggestionEmpty, suggestionNoun } from "./suggestion-strategies";

function SuggestionMeta({ suggestion }: { suggestion: KeywordSuggestion }) {
  const t = useTranslations("keywords");
  const noun = suggestionNoun(suggestion.strategy, t);
  return (
    <span className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
      {suggestion.seed ? (
        <span className="wrap-anywhere">
          {t("suggestions.fromSeed", { seed: suggestion.seed })}
        </span>
      ) : null}
      {suggestion.usedByCount !== undefined ? (
        <span className="numeric">
          {t("suggestions.usedBy", {
            count: suggestion.usedByCount,
            noun,
          })}
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
      <span className="max-w-full truncate text-body font-medium">
        {suggestion.text}
      </span>
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
  tickRef,
  onFocus,
}: {
  id: string;
  suggestion: KeywordSuggestion;
  checked: boolean;
  disabled?: boolean;
  onToggle: (text: string, selected: boolean) => void;
  tickRef?: Ref<HTMLButtonElement>;
  onFocus?: () => void;
}) {
  return (
    <>
      <Checkbox
        ref={tickRef}
        id={id}
        checked={checked}
        disabled={disabled}
        onFocus={onFocus}
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
  ref,
}: {
  text: string;
  already: boolean;
  pending: boolean;
  onTrack: (text: string) => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("keywords");
  const inert = already || pending;
  return (
    <Button
      ref={ref}
      variant={already ? "ghost" : "outline"}
      size="sm"
      aria-label={
        already
          ? t("suggestions.trackedLabel", { keyword: text })
          : t("suggestions.trackLabel", { keyword: text })
      }
      aria-disabled={inert || undefined}
      aria-busy={(pending && !already) || undefined}
      onClick={() => {
        if (!inert) onTrack(text);
      }}
    >
      {already ? (
        <>
          <Check />
          {t("suggestions.tracked")}
        </>
      ) : (
        <>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("suggestions.track")}
        </>
      )}
    </Button>
  );
}

function TrackOrSelectRow({
  suggestion,
  tickId,
  already,
  action,
}: {
  suggestion: KeywordSuggestion;
  tickId: string;
  already: boolean;
  action: TrackHandlers & SelectHandlers;
}) {
  const tick = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLButtonElement>(null);
  const handOffFocus = useFocusAfterCommit();
  const { text } = suggestion;

  return (
    <li className="flex items-center gap-3 border-b border-border-subtle py-2">
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
          tickRef={tick}
          onFocus={() => handOffFocus(track.current, tick.current)}
        />
      )}
      <TrackAction
        ref={track}
        text={text}
        already={already}
        pending={action.pending.has(text)}
        onTrack={action.onTrack}
      />
    </li>
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
  const t = useTranslations("keywords");

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
            : t("suggestions.loadFailed")}
        </span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          {t("suggestions.retry")}
        </Button>
      </div>
    );
  }

  if (state.suggestions.length === 0) {
    return (
      <p className="max-w-prose text-body text-muted-foreground">
        {suggestionEmpty(strategy, t)}
      </p>
    );
  }

  return (
    <div className="@container">
      <ul className="grid grid-cols-1 gap-x-8 @2xl:grid-cols-2 @5xl:grid-cols-3">
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
                {already ? (
                  <Badge variant="outline">{t("suggestions.tracked")}</Badge>
                ) : null}
              </li>
            );
          }
          if (action.kind === "trackOrSelect") {
            return (
              <TrackOrSelectRow
                key={text}
                suggestion={suggestion}
                tickId={tickId}
                already={already}
                action={action}
              />
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
              <TrackAction
                text={text}
                already={already}
                pending={action.pending.has(text)}
                onTrack={action.onTrack}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
