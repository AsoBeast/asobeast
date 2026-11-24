"use client";

import { useQuery } from "@tanstack/react-query";
import type { KeywordSuggestion } from "@asobeast/shared";
import { isSpiderTerm } from "@asobeast/shared";
import { keywordsOptions, spiderOptions } from "@/lib/queries";
import { ideaSuggestions } from "./ideas-selection";

const PROBES_TOTAL = 27;
const SPIDER_POLL_MS = 3000;

export interface IdeasStatus {
  found: KeywordSuggestion[];
  trackedTexts: Set<string>;
  probesDone: number;
  probesTotal: number;
  complete: boolean;
  error: unknown;
  failed: boolean;
  retry: () => void;
}

export function useIdeasStatus(
  id: string,
  seed: string,
  country: string,
  requested = false,
): IdeasStatus {
  const tracked = useQuery(keywordsOptions(id, country));
  const status = useQuery({
    ...spiderOptions(id, seed, country),
    enabled: isSpiderTerm(seed),
    refetchInterval: (query) =>
      (requested || (query.state.data?.probesDone ?? 0) > 0) &&
      !query.state.data?.complete
        ? SPIDER_POLL_MS
        : false,
  });
  return {
    found: ideaSuggestions(status.data?.suggestions ?? []),
    trackedTexts: new Set((tracked.data ?? []).map((keyword) => keyword.text)),
    probesDone: status.data?.probesDone ?? 0,
    probesTotal: status.data?.probesTotal ?? PROBES_TOTAL,
    complete: status.data?.complete ?? false,
    error: status.error,
    failed: status.isError,
    retry: () => void status.refetch(),
  };
}
