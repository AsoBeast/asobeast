"use client";

import type { RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { removeKeyword } from "@/lib/api";
import {
  returnFocusTo,
  siblingControl,
  useCloseFocusHandoff,
} from "@/lib/focus-handoff";
import { invalidateKeywordMutation } from "@/lib/queries";

const ROW_MENU = 'button[aria-label^="Keyword actions for "]';

const neighbouringMenu = (menu: HTMLElement | null): HTMLElement | null =>
  siblingControl(menu?.closest("tr") ?? null, ROW_MENU);

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
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();
  const remove = useMutation({
    mutationFn: () => removeKeyword(appId, keyword.keywordId),
    onSuccess: () => {
      invalidateKeywordMutation(queryClient, appId);
      toast.success(`Stopped tracking ${keyword.text}`);
    },
    onError: () => toast.error(`Could not stop tracking ${keyword.text}`),
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(remove.isPending, onOpenChange)}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus(event);
          if (!event.defaultPrevented) returnFocusTo(returnFocus)(event);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Stop tracking {keyword.text}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ranking history for this keyword stops accruing. You can add it
            again later, but the gap in history will remain.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={remove.isPending}
          label="Stop tracking"
          pendingLabel="Removing…"
          onConfirm={() => {
            const successor = neighbouringMenu(returnFocus.current);
            void remove.mutateAsync().then(
              () => {
                handOff(successor);
                onOpenChange(false);
              },
              () => undefined,
            );
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
