"use client";

import { useRef, useState, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Button } from "@/components/ui/button";
import { removeKeyword, updateKeyword } from "@/lib/api";
import type { BulkTagChange, BulkTagMode } from "@/lib/keyword-tags";
import { invalidateKeywordMutation } from "@/lib/queries";
import { BulkTagPopover } from "./BulkTagPopover";

function summarize(results: PromiseSettledResult<unknown>[]): {
  ok: number;
  failed: number;
} {
  const failed = results.filter(
    (result) => result.status === "rejected",
  ).length;
  return { ok: results.length - failed, failed };
}

function report(verb: string, results: PromiseSettledResult<unknown>[]): void {
  const { ok, failed } = summarize(results);
  if (failed === 0) {
    toast.success(`${verb} ${ok} keyword${ok === 1 ? "" : "s"}`);
    return;
  }
  toast.warning(`${verb} ${ok}, ${failed} failed`);
}

function ConfirmRemove({
  open,
  onOpenChange,
  count,
  pending,
  disabled,
  removed,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  pending: boolean;
  disabled: boolean;
  removed: RefObject<boolean>;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
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
            Stop tracking {count} keyword
            {count === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ranking history for the selected keywords stops accruing. You can
            add them again later, but the gap in history will remain.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Removing…" : "Stop tracking"}
          </AlertDialogAction>
        </AlertDialogFooter>
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

  const setActive = useMutation({
    mutationFn: (active: boolean) =>
      Promise.allSettled(
        selectedIds.map((id) => updateKeyword(appId, id, { active })),
      ),
    onSuccess: (results, active) => {
      report(active ? "Activated" : "Paused", results);
      invalidateKeywordMutation(queryClient, appId);
      onClear();
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      Promise.allSettled(selectedIds.map((id) => removeKeyword(appId, id))),
    onSuccess: (results) => {
      report("Removed", results);
      invalidateKeywordMutation(queryClient, appId);
      removed.current = true;
      setConfirmOpen(false);
      onClear();
    },
  });

  const tagSelected = useMutation({
    mutationFn: ({
      changes,
    }: {
      changes: BulkTagChange[];
      mode: BulkTagMode;
    }) =>
      Promise.allSettled(
        changes.map((change) =>
          updateKeyword(appId, change.keywordId, { tags: change.tags }),
        ),
      ),
    onSuccess: (results, { mode }) => {
      report(mode === "add" ? "Tagged" : "Untagged", results);
      invalidateKeywordMutation(queryClient, appId);
      onClear();
    },
  });

  const busy = setActive.isPending || remove.isPending || tagSelected.isPending;

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
          disabled={busy}
          onClick={() => setActive.mutate(false)}
        >
          <Pause />
          Pause
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setActive.mutate(true)}
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
          pending={remove.isPending}
          disabled={busy}
          removed={removed}
          onConfirm={() => remove.mutate()}
        />
        <ExportCsvButton subject="selected keywords" onClick={onExport} />
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X />
          Clear
        </Button>
      </div>
    </div>
  );
}
