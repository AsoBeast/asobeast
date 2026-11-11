"use client";

import type { RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/alert-dialog";
import { removeKeyword } from "@/lib/api";
import { returnFocusTo } from "@/lib/focus-handoff";
import { invalidateKeywordMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export function StopTrackingDialog({
  open,
  onOpenChange,
  appId,
  keyword,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  keyword: Pick<TrackedKeywordItem, "keywordId" | "text">;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeKeyword(appId, keyword.keywordId),
    onSuccess: () => {
      invalidateKeywordMutation(queryClient, appId);
      onOpenChange(false);
      toast.success(`Stopped tracking ${keyword.text}`);
    },
    onError: () => toast.error(`Could not stop tracking ${keyword.text}`),
  });
  const removeOnce = useSingleFlight(remove);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={returnFocusTo(returnFocus)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop tracking {keyword.text}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ranking history for this keyword stops accruing. You can add it
            again later, but the gap in history will remain.
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
              removeOnce();
            }}
          >
            {remove.isPending ? "Removing…" : "Stop tracking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
