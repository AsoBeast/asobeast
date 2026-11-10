"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  normalizeText,
  type KeywordInspection,
  type KeywordInspectionRequest,
  type KeywordInspectionSummary,
} from "@asobeast/shared";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ApiError, requestKeywordInspection } from "@/lib/api";
import { refreshKeywordInspections } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  nextHops,
  suggestionState,
  type SuggestionState,
} from "./inspection-map";

const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50";

const startKey = ({ keyword, store, country }: KeywordInspectionRequest) =>
  `${store}|${country}|${normalizeText(keyword)}`;

const failureMessage = (error: unknown): string =>
  error instanceof ApiError
    ? error.envelope.message
    : "Could not start the inspection";

function HopChip({
  term,
  state,
  starting,
  onInspect,
  onSelect,
}: {
  term: string;
  state: SuggestionState;
  starting: boolean;
  onInspect: (term: string) => void;
  onSelect: (id: string) => void;
}) {
  if (state.kind === "done") {
    return (
      <button
        type="button"
        onClick={() => onSelect(state.id)}
        aria-label={`${term}, inspected: popularity ${state.popularity}, difficulty ${state.difficulty}`}
        className={cn(CHIP, "bg-muted/60 hover:bg-muted")}
      >
        <span>{term}</span>
        <span className="numeric font-mono text-xs text-muted-foreground">
          {state.popularity}·{state.difficulty}
        </span>
      </button>
    );
  }
  if (state.kind === "running" || starting) {
    return (
      <span
        role="status"
        aria-label={`Inspecting ${term}`}
        className={cn(CHIP, "border-info/40 bg-info/10 text-foreground")}
      >
        <Loader2 aria-hidden className="size-3.5 animate-spin text-info" />
        {term}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onInspect(term)}
      aria-label={`Inspect ${term}`}
      className={cn(
        CHIP,
        "bg-card hover:border-foreground/30 hover:bg-muted/60",
      )}
    >
      <Plus aria-hidden className="size-3.5 text-muted-foreground" />
      {term}
    </button>
  );
}

export function NextHops({
  inspection,
  items,
  onSelect,
  onPreview,
}: {
  inspection: KeywordInspection;
  items: readonly KeywordInspectionSummary[];
  onSelect: (id: string) => void;
  onPreview: (term: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const storefront = { store: inspection.store, country: inspection.country };
  const [starting, setStarting] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const settle = (request: KeywordInspectionRequest) =>
    setStarting((current) => {
      const next = new Set(current);
      next.delete(startKey(request));
      return next;
    });
  const inspect = useMutation({
    mutationFn: (request: KeywordInspectionRequest) =>
      requestKeywordInspection(request),
    onMutate: (request) =>
      setStarting((current) => new Set(current).add(startKey(request))),
    onSuccess: () => refreshKeywordInspections(queryClient),
    onError: (error) => toast.error(failureMessage(error)),
    onSettled: (_data, _error, request) => settle(request),
  });
  useEffect(() => () => onPreview(null), [onPreview]);
  const terms = nextHops(
    inspection.keyword,
    inspection.suggestions.map((suggestion) => suggestion.term),
  );

  return (
    <section
      aria-labelledby="inspection-next"
      className="flex flex-col gap-2 border-t pt-3"
    >
      <h3 id="inspection-next" className="text-sm font-medium">
        Next from “{inspection.keyword}”
        <span className="ml-2 font-normal text-muted-foreground">
          store autocomplete, one click to inspect
        </span>
      </h3>
      {terms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The store suggested nothing else for this keyword.
        </p>
      ) : (
        <ol className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <li
              key={term}
              onPointerEnter={() => onPreview(term)}
              onPointerLeave={() => onPreview(null)}
              onFocus={() => onPreview(term)}
              onBlur={() => onPreview(null)}
            >
              <HopChip
                term={term}
                state={suggestionState(term, items, storefront)}
                starting={starting.has(
                  startKey({ keyword: term, ...storefront }),
                )}
                onInspect={(keyword) =>
                  inspect.mutate({ keyword, ...storefront })
                }
                onSelect={onSelect}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
