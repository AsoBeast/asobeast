"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type KeywordImportRequest, type Store } from "@asobeast/shared";
import { ApiError, importKeywords } from "@/lib/api";
import type { ImportTarget } from "@/lib/csv-import/scope";
import {
  appsLeftToChoose,
  initialView,
  mapKeywordFile,
  readKeywordFile,
  type FileView,
  type KeywordFile,
  type MappedFile,
} from "@/lib/csv-import/parse-keyword-file";
import type { MessageTranslator } from "@/i18n/translator";
import {
  importAction,
  importParts,
  importToast,
  marketRefusal,
  partNotice,
  partRows,
  refusalMessage,
  refuseImport,
  type ImportProgress,
} from "@/lib/keyword-import";
import {
  appDetailOptions,
  importPreviewRequest,
  invalidateKeywordImport,
  invalidateKeywordMutation,
  keywordImportPreviewOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

const MAX_FILE_BYTES = 2_000_000;

interface Loaded {
  name: string;
  file: KeywordFile;
}

function previewMessage(
  error: Error | null,
  t: MessageTranslator,
): string | null {
  if (error === null) return null;
  return error instanceof ApiError
    ? error.envelope.message
    : t("import.reviewUnreachable");
}

function submitMessage(
  error: Error | null,
  t: MessageTranslator,
): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    return error.envelope.quota ? t("import.raceLost") : error.envelope.message;
  }
  return error.message;
}

function appsStillToChoose(
  loaded: Loaded | null,
  view: FileView | null,
  mapped: MappedFile | null,
): number {
  return loaded && view && mapped
    ? appsLeftToChoose(loaded.file, view, mapped)
    : 0;
}

const sameRows = (
  previous: KeywordImportRequest | null,
  next: KeywordImportRequest | null,
): boolean =>
  previous !== null &&
  next !== null &&
  previous.rows.length === next.rows.length &&
  previous.rows.every((row, index) => row === next.rows[index]);

function useImportParts(
  mapped: MappedFile | null,
  market: string,
  t: MessageTranslator,
) {
  const [index, setIndex] = useState(0);
  const refusal = useMemo(
    () => (mapped ? refuseImport(mapped, market) : null),
    [mapped, market],
  );
  const parts = useMemo(
    () => (mapped && !refusal ? importParts(mapped.rows, market) : []),
    [mapped, refusal, market],
  );
  const progress = useMemo<ImportProgress>(
    () => ({
      index: Math.min(index, Math.max(parts.length - 1, 0)),
      count: parts.length,
    }),
    [index, parts.length],
  );
  const current = useMemo(() => {
    const part = parts[progress.index];
    return mapped && part ? partRows(mapped, part) : null;
  }, [mapped, parts, progress.index]);
  return {
    refusal,
    progress,
    current,
    lines: current?.lines ?? [],
    notice: mapped ? partNotice(parts, progress, mapped.lines, t) : null,
    setIndex,
  };
}

export function useKeywordImport(
  appId: string,
  store: Store,
  homeMarket: string,
  onImported: () => void,
) {
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [view, setView] = useState<FileView | null>(null);
  const [market, setMarket] = useState(homeMarket);
  const [readError, setReadError] = useState<string | null>(null);
  const latestChoice = useRef(0);

  const detail = useCachedQueryData(appDetailOptions(appId).queryKey);
  const target = useMemo<ImportTarget | null>(
    () =>
      detail ? { storeAppId: detail.storeAppId, name: detail.name } : null,
    [detail],
  );

  const mapped = useMemo(
    () => (loaded && view ? mapKeywordFile(loaded.file, view, store) : null),
    [loaded, view, store],
  );
  const appsToChoose = appsStillToChoose(loaded, view, mapped);
  const partFlow = useImportParts(mapped, market, t);
  const { refusal, current, progress } = partFlow;
  const unknownMarket =
    mapped && !refusal ? marketRefusal(store, market, t) : null;
  const request = useMemo<KeywordImportRequest | null>(
    () =>
      current && !unknownMarket
        ? { rows: current.rows, country: market }
        : null,
    [current, unknownMarket, market],
  );
  const preview = useQuery({
    ...keywordImportPreviewOptions(appId, request),
    placeholderData: (previous, query) =>
      query && sameRows(importPreviewRequest(query.queryKey), request)
        ? previous
        : undefined,
  });

  function changeView(next: FileView) {
    setView(next);
    partFlow.setIndex(0);
  }

  function changeMarket(next: string) {
    setMarket(next);
    partFlow.setIndex(0);
  }

  function forget(error: string | null) {
    latestChoice.current += 1;
    setLoaded(null);
    setView(null);
    partFlow.setIndex(0);
    setReadError(error);
  }

  const submit = useMutation({
    mutationFn: () => {
      if (request === null) throw new Error(t("import.nothingToSend"));
      return importKeywords(appId, request);
    },
    onSuccess: (outcome) => {
      invalidateKeywordMutation(queryClient, appId);
      const { title, description } = importToast(outcome, progress, t);
      toast.success(title, { description });
      if (progress.index + 1 < progress.count) {
        partFlow.setIndex(progress.index + 1);
        return;
      }
      forget(null);
      setMarket(homeMarket);
      onImported();
    },
    onError: () => invalidateKeywordImport(queryClient, appId),
  });
  const submitOnce = useSingleFlight(submit);

  async function choose(file: File | undefined) {
    if (!file) return;
    submit.reset();
    if (file.size > MAX_FILE_BYTES) {
      forget(t("import.fileTooLarge"));
      return;
    }
    latestChoice.current += 1;
    const choice = latestChoice.current;
    try {
      const parsed = readKeywordFile(await file.arrayBuffer());
      if (choice !== latestChoice.current) return;
      setReadError(null);
      setLoaded({ name: file.name, file: parsed });
      changeView(initialView(parsed, target));
    } catch {
      if (choice === latestChoice.current) forget(t("import.fileUnreadable"));
    }
  }

  function reset(next: string) {
    forget(null);
    setMarket(next);
    submit.reset();
  }

  const blocking =
    readError ??
    (refusal ? refusalMessage(refusal, t) : null) ??
    unknownMarket ??
    previewMessage(preview.error, t);
  const result = request === null ? null : (preview.data ?? null);
  const ready =
    appsToChoose === 0 &&
    blocking === null &&
    !preview.isFetching &&
    !submit.isPending;

  function skip() {
    submit.reset();
    partFlow.setIndex(progress.index + 1);
  }

  return {
    loaded,
    view,
    setView: changeView,
    market,
    setMarket: changeMarket,
    mapped,
    lines: partFlow.lines,
    partNotice: partFlow.notice,
    result,
    busy: preview.isFetching,
    importing: submit.isPending,
    error: blocking ?? submitMessage(submit.error, t),
    appsToChoose,
    progress,
    action: ready ? importAction(result, progress) : null,
    choose,
    reset,
    submit: () => submitOnce(),
    skip,
  };
}
