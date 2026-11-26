"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import type { MessageTranslator } from "@/i18n/translator";
import { refreshKeywordInspections } from "@/lib/queries";
import {
  nextHops,
  suggestionState,
  type SuggestionState,
} from "./inspection-map";

const CHIP =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-label whitespace-nowrap outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-60 aria-disabled:hover:bg-card";

const startKey = ({ keyword, store, country }: KeywordInspectionRequest) =>
  `${store}|${country}|${normalizeText(keyword)}`;

const failureMessage = (error: unknown, t: MessageTranslator): string =>
  error instanceof ApiError
    ? error.envelope.message
    : t("inspector.next.failed");

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
  const t = useTranslations("keywordInspector");
  if (state.kind === "done") {
    return (
      <button
        type="button"
        onClick={() => onSelect(state.id)}
        aria-label={t("inspector.next.done", {
          term,
          popularity: state.popularity,
          difficulty: state.difficulty,
        })}
        className={CHIP}
      >
        <span>{term}</span>
        <span className="numeric font-normal text-faint-foreground">
          {`${state.popularity} · ${state.difficulty}`}
        </span>
      </button>
    );
  }
  if (state.kind === "running" || starting) {
    return (
      <button
        type="button"
        aria-disabled
        aria-label={t("inspector.next.running", { term })}
        className={CHIP}
      >
        <Loader2
          aria-hidden
          className="size-3.5 animate-spin text-muted-foreground"
        />
        <span>{term}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onInspect(term)}
      aria-label={t("inspector.next.inspect", { term })}
      className={CHIP}
    >
      <Plus aria-hidden className="size-3.5 text-muted-foreground" />
      <span>{term}</span>
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
  const t = useTranslations("keywordInspector");
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
    onError: (error) => toast.error(failureMessage(error, t)),
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
      className="flex min-w-0 flex-col gap-2 border-t px-4 py-3"
    >
      <h3 id="inspection-next" className="text-label font-medium">
        {t("inspector.next.title", { keyword: inspection.keyword })}
      </h3>
      {terms.length === 0 ? (
        <p className="text-caption text-faint-foreground">
          {t("inspector.next.empty")}
        </p>
      ) : (
        <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
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
