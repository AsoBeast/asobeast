"use client";

import type { RefObject } from "react";
import {
  ConfirmActionFooter,
  closeUnlessPending,
} from "@/components/ConfirmActionFooter";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { returnFocusTo } from "@/lib/focus-handoff";

export function HideChecklistDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(pending, onOpenChange)}
    >
      <AlertDialogContent onCloseAutoFocus={returnFocusTo(returnFocus)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Hide the setup checklist?</AlertDialogTitle>
          <AlertDialogDescription>
            It stays hidden for everyone in this workspace. You can show it
            again under Settings, Getting started.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          variant="default"
          pending={pending}
          label="Hide checklist"
          pendingLabel="Hiding…"
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
