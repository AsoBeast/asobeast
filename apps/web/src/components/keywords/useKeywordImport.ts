"use client";

import { useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
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
  marketRefusal,
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

const FILE_UNREADABLE =
  "That file could not be read. Choose it again, or save a copy of it and choose the copy.";

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
  const latestChoice = useRef(0);

  const mapped = useMemo(
    () => (loaded && view ? mapKeywordFile(loaded.file, view) : null),
    [loaded, view],
  );
  const refusal = useMemo(
    () => (mapped ? refuseImport(mapped.rows, market) : null),
    [mapped, market],
  );
  const unknownMarket =
    mapped && !refusal ? marketRefusal(store, market) : null;
  const request = useMemo<KeywordImportRequest | null>(
    () =>
      mapped && !refusal && !unknownMarket
        ? { rows: mapped.rows, country: market }
        : null,
    [mapped, refusal, unknownMarket, market],
  );
  const preview = useQuery({
    ...keywordImportPreviewOptions(appId, request),
    placeholderData: keepPreviousData,
  });

  function forget(error: string | null) {
    latestChoice.current += 1;
    setLoaded(null);
    setView(null);
    setReadError(error);
  }

  const submit = useMutation({
    mutationFn: () => {
      if (request === null) throw new Error("There is nothing to import");
      return importKeywords(appId, request);
    },
    onSuccess: (outcome) => {
      forget(null);
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
      forget(FILE_TOO_LARGE);
      return;
    }
    latestChoice.current += 1;
    const choice = latestChoice.current;
    try {
      const parsed = readKeywordFile(await file.arrayBuffer());
      if (choice !== latestChoice.current) return;
      setReadError(null);
      setLoaded({ name: file.name, file: parsed });
      setView(initialView(parsed));
    } catch {
      if (choice === latestChoice.current) forget(FILE_UNREADABLE);
    }
  }

  function reset(next: string) {
    forget(null);
    setMarket(next);
    submit.reset();
  }

  const blocking =
    readError ??
    (refusal ? refusalMessage(refusal) : null) ??
    unknownMarket ??
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
