"use client";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

export const closeUnlessPending =
  (pending: boolean, setOpen: (open: boolean) => void) =>
  (open: boolean): void => {
    if (open || !pending) setOpen(open);
  };

export function ConfirmActionFooter({
  pending,
  label,
  pendingLabel,
  onConfirm,
  variant = "destructive",
  cancelLabel = "Cancel",
  blocked = false,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
  cancelLabel?: string;
  blocked?: boolean;
}) {
  return (
    <AlertDialogFooter>
      <AlertDialogCancel
        aria-disabled={pending || undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {cancelLabel}
      </AlertDialogCancel>
      <AlertDialogAction
        variant={variant}
        disabled={blocked}
        aria-disabled={pending || undefined}
        onClick={(event) => {
          event.preventDefault();
          if (!pending) onConfirm();
        }}
      >
        {pending ? pendingLabel : label}
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}
