"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Pause, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { removeKeyword, updateKeyword } from "@/lib/api";
import { invalidateKeywordMutation } from "@/lib/queries";

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

export function KeywordsBulkActions({
  appId,
  selectedIds,
  onClear,
  onExport,
}: {
  appId: string;
  selectedIds: string[];
  onClear: () => void;
  onExport: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      setConfirmOpen(false);
      onClear();
    },
  });

  const busy = setActive.isPending || remove.isPending;

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
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 />
          Remove
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          aria-label="Export selected keywords to CSV"
        >
          <Download />
          Export CSV
        </Button>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Stop tracking {selectedIds.length} keyword
              {selectedIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ranking history for the selected keywords stops accruing. You can
              add them again later, but the gap in history will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                remove.mutate();
              }}
            >
              {remove.isPending ? "Removing…" : "Stop tracking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
