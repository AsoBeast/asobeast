"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  isStorefront,
  KEYWORD_IMPORT_LIMIT,
  type KeywordImportRequest,
  type Store,
} from "@asobeast/shared";
import { ApiError, importKeywords } from "@/lib/api";
import {
  initialView,
  mapKeywordFile,
  readKeywordFile,
  type FileView,
  type KeywordFile,
} from "@/lib/csv-import/parse-keyword-file";
import { formatNumber } from "@/lib/format";
import {
  importableCount,
  importToast,
  refusalMessage,
  refuseImport,
} from "@/lib/keyword-import";
import {
  invalidateKeywordImport,
  invalidateKeywordMutation,
  keywordImportPreviewOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

const MAX_FILE_BYTES = 2_000_000;

const FILE_TOO_LARGE = `That file is too large to be a keyword list. One import takes up to ${formatNumber(KEYWORD_IMPORT_LIMIT)} rows.`;

const RACE_LOST =
  "Your plan's keyword limit was reached by another change. Nothing was imported. The review has been refreshed.";

interface Loaded {
  name: string;
  file: KeywordFile;
}

function submitMessage(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    return error.envelope.quota ? RACE_LOST : error.envelope.message;
  }
  return error.message;
}

export function useKeywordImport(
  appId: string,
  store: Store,
  homeMarket: string,
  onImported: () => void,
) {
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [view, setView] = useState<FileView | null>(null);
  const [market, setMarket] = useState(homeMarket);
  const [readError, setReadError] = useState<string | null>(null);

  const mapped = useMemo(
    () => (loaded && view ? mapKeywordFile(loaded.file, view) : null),
    [loaded, view],
  );
  const refusal = useMemo(
    () => (mapped ? refuseImport(mapped.rows, market) : null),
    [mapped, market],
  );
  const request = useMemo<KeywordImportRequest | null>(
    () =>
      mapped && !refusal && isStorefront(store, market)
        ? { rows: mapped.rows, country: market }
        : null,
    [mapped, refusal, market, store],
  );
  const preview = useQuery({
    ...keywordImportPreviewOptions(appId, request),
    placeholderData: keepPreviousData,
  });

  const submit = useMutation({
    mutationFn: () => {
      if (request === null) throw new Error("There is nothing to import");
      return importKeywords(appId, request);
    },
    onSuccess: (outcome) => {
      setLoaded(null);
      setView(null);
      setMarket(homeMarket);
      invalidateKeywordMutation(queryClient, appId);
      const { title, description } = importToast(outcome);
      toast.success(title, { description });
      onImported();
    },
    onError: () => invalidateKeywordImport(queryClient, appId),
  });
  const submitOnce = useSingleFlight(submit);

  async function choose(file: File | undefined) {
    if (!file) return;
    submit.reset();
    if (file.size > MAX_FILE_BYTES) {
      setLoaded(null);
      setView(null);
      setReadError(FILE_TOO_LARGE);
      return;
    }
    const parsed = readKeywordFile(await file.arrayBuffer());
    setReadError(null);
    setLoaded({ name: file.name, file: parsed });
    setView(initialView(parsed));
  }

  function reset(next: string) {
    setLoaded(null);
    setView(null);
    setMarket(next);
    setReadError(null);
    submit.reset();
  }

  const blocking =
    readError ??
    (refusal ? refusalMessage(refusal) : null) ??
    (preview.error instanceof ApiError ? preview.error.envelope.message : null);
  const result = request === null ? null : (preview.data ?? null);

  return {
    loaded,
    view,
    setView,
    market,
    setMarket,
    mapped,
    result,
    busy: preview.isFetching,
    importing: submit.isPending,
    error: blocking ?? submitMessage(submit.error),
    canImport:
      result !== null &&
      importableCount(result.summary) > 0 &&
      blocking === null &&
      !preview.isFetching &&
      !submit.isPending,
    choose,
    reset,
    submit: () => submitOnce(),
  };
}
