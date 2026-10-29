"use client";

import { useRef, useState, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { KeywordBulkAction, TrackedKeywordItem } from "@asobeast/shared";
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
import { pluralize } from "@/lib/format";
import { bulkInChunks, bulkReport } from "@/lib/keyword-bulk";
import type { BulkTagChange, BulkTagMode } from "@/lib/keyword-tags";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { BulkTagPopover } from "./BulkTagPopover";

interface BulkChange {
  action: KeywordBulkAction;
  keywordIds: string[];
}

function reportTagging(
  verb: string,
  results: PromiseSettledResult<unknown>[],
): void {
  const failed = results.filter(
    (result) => result.status === "rejected",
  ).length;
  const ok = results.length - failed;
  if (failed === 0) {
    toast.success(`${verb} ${pluralize(ok, "keyword")}`);
    return;
  }
  toast.warning(`${verb} ${ok}, ${failed} failed`);
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
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (removed.current) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Stop tracking {pluralize(count, "keyword")}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ranking history for the selected keywords stops accruing. You can
            add them again later, but the gap in history will remain.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={pending}
          label="Stop tracking"
          pendingLabel="Removing…"
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function KeywordsBulkActions({
  appId,
  selectedKeywords,
  marketTags,
  onClear,
  onExport,
}: {
  appId: string;
  selectedKeywords: readonly TrackedKeywordItem[];
  marketTags: readonly string[];
  onClear: () => void;
  onExport: () => void;
}) {
  const queryClient = useQueryClient();
  const selectedIds = selectedKeywords.map((keyword) => keyword.keywordId);
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
      reportTagging(mode === "add" ? "Tagged" : "Untagged", results);
      invalidateKeywordMutation(queryClient, appId);
      onClear();
    },
  });

  const busy = change.isPending || tagSelected.isPending;
  const run = (action: KeywordBulkAction) => {
    if (!busy) changeOnce({ action, keywordIds: selectedIds });
  };

  return (
    <div
      role="group"
      aria-label="Bulk keyword actions"
      className="flex flex-wrap items-center gap-2 rounded-xl border bg-popover px-3 py-2 text-body shadow-overlay"
    >
      <span className="numeric font-mono font-medium">
        {selectedIds.length} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-disabled={busy || undefined}
          onClick={() => run("pause")}
        >
          <Pause />
          Pause
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-disabled={busy || undefined}
          onClick={() => run("resume")}
        >
          <Play />
          Activate
        </Button>
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
        <ExportCsvButton subject="selected keywords" onClick={onExport} />
        <Button
          variant="ghost"
          size="sm"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onClear();
          }}
          aria-label="Clear selection"
        >
          <X />
          Clear
        </Button>
      </div>
    </div>
  );
}
