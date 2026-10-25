"use client";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

export function ConfirmActionFooter({
  pending,
  label,
  pendingLabel,
  onConfirm,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialogFooter>
      <AlertDialogCancel
        aria-disabled={pending || undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction
        variant="destructive"
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
