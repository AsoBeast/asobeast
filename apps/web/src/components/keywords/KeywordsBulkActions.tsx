"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChartLine, Pause, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { KeywordBulkAction, TrackedKeywordItem } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Button } from "@/components/ui/button";
import { applyKeywordBulk, updateKeyword } from "@/lib/api";
import { bulkInChunks, bulkReport } from "@/lib/keyword-bulk";
import type { BulkTagChange, BulkTagMode } from "@/lib/keyword-tags";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { BulkTagPopover } from "./BulkTagPopover";
import { chartLimitLine, overChartLimit } from "./dynamics-selection";

interface BulkChange {
  action: KeywordBulkAction;
  keywordIds: string[];
}

function reportTagging(
  t: MessageTranslator,
  verb: string,
  results: PromiseSettledResult<unknown>[],
): void {
  const failed = results.filter(
    (result) => result.status === "rejected",
  ).length;
  const ok = results.length - failed;
  if (failed === 0) {
    toast.success(t("bulk.changed", { done: verb, count: ok }));
    return;
  }
  toast.warning(t("bulk.tagPartial", { verb, changed: ok, failed }));
}

function ConfirmRemove({
  open,
  onOpenChange,
  count,
  pending,
  busy,
  removed,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  pending: boolean;
  busy: boolean;
  removed: RefObject<boolean>;
  onConfirm: () => void;
}) {
  const t = useTranslations("keywords");
  const settle = closeUnlessPending(pending, onOpenChange);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next && busy) return;
        settle(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" aria-disabled={busy || undefined}>
          <Trash2 />
          {t("bulk.stop")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (removed.current) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bulk.stopTitle", { count })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("bulk.stopDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={pending}
          label={t("bulk.stop")}
          pendingLabel={t("bulk.removing")}
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const SHOW_DYNAMICS_BUTTON_ID = "show-keyword-dynamics";

export function KeywordsBulkActions({
  appId,
  selectedKeywords,
  marketTags,
  onClear,
  onExport,
  onShowDynamics,
  fieldAction,
}: {
  appId: string;
  selectedKeywords: readonly TrackedKeywordItem[];
  marketTags: readonly string[];
  onClear: () => void;
  onExport: () => void;
  onShowDynamics: () => void;
  fieldAction?: ReactNode;
}) {
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const selectedIds = selectedKeywords.map((keyword) => keyword.keywordId);
  const overCap = overChartLimit(selectedIds.length);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const removed = useRef(false);

  const change = useMutation({
    mutationFn: ({ action, keywordIds }: BulkChange) =>
      bulkInChunks(keywordIds, (chunk) =>
        applyKeywordBulk(appId, { action, keywordIds: chunk }),
      ),
    onSuccess: (outcome, { action, keywordIds }) => {
      const { level, message, description } = bulkReport(
        action,
        outcome,
        keywordIds.length,
        t,
      );
      toast[level](message, { description });
      invalidateKeywordMutation(queryClient, appId);
      if (outcome.error !== undefined) return;
      removed.current = action === "untrack";
      setConfirmOpen(false);
      onClear();
    },
  });
  const changeOnce = useSingleFlight(change);

  const tagSelected = useMutation({
    mutationFn: ({
      changes,
    }: {
      changes: BulkTagChange[];
      mode: BulkTagMode;
    }) =>
      Promise.allSettled(
        changes.map((tagChange) =>
          updateKeyword(appId, tagChange.keywordId, { tags: tagChange.tags }),
        ),
      ),
    onSuccess: (results, { mode }) => {
      reportTagging(
        t,
        mode === "add" ? t("bulk.taggedVerb") : t("bulk.untaggedVerb"),
        results,
      );
      invalidateKeywordMutation(queryClient, appId);
      onClear();
    },
  });

  const busy = change.isPending || tagSelected.isPending;
  const anyActive = selectedKeywords.some((keyword) => keyword.active);
  const anyPaused = selectedKeywords.some((keyword) => !keyword.active);
  const run = (action: KeywordBulkAction) => {
    if (!busy) changeOnce({ action, keywordIds: selectedIds });
  };

  return (
    <div
      role="group"
      aria-label={t("bulk.label")}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-body shadow-overlay"
    >
      <span className="numeric font-medium">
        {t("bulk.selected", { count: selectedIds.length })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          id={SHOW_DYNAMICS_BUTTON_ID}
          aria-disabled={overCap || undefined}
          onClick={() => {
            if (!overCap) onShowDynamics();
          }}
        >
          <ChartLine />
          {t("bulk.showDynamics")}
        </Button>
        {overCap ? (
          <span className="text-caption text-muted-foreground">
            {chartLimitLine(t)}
          </span>
        ) : null}
        {anyActive ? (
          <Button
            variant="outline"
            size="sm"
            aria-disabled={busy || undefined}
            onClick={() => run("pause")}
          >
            <Pause />
            {t("bulk.pause")}
          </Button>
        ) : null}
        {anyPaused ? (
          <Button
            variant="outline"
            size="sm"
            aria-disabled={busy || undefined}
            onClick={() => run("resume")}
          >
            <Play />
            {t("bulk.activate")}
          </Button>
        ) : null}
        <BulkTagPopover
          keywords={selectedKeywords}
          marketTags={marketTags}
          disabled={busy}
          onApply={(changes, mode) => tagSelected.mutate({ changes, mode })}
        />
        <ConfirmRemove
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          count={selectedIds.length}
          pending={change.isPending}
          busy={busy}
          removed={removed}
          onConfirm={() => run("untrack")}
        />
        {fieldAction}
        <ExportCsvButton subject={t("bulk.exportSubject")} onClick={onExport} />
        <Button
          variant="ghost"
          size="sm"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onClear();
          }}
          aria-label={t("bulk.clearSelection")}
        >
          <X />
          {t("bulk.clear")}
        </Button>
      </div>
    </div>
  );
}
