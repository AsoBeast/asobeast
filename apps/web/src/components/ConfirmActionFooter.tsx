"use client";

import { useTranslations } from "next-intl";
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
  cancelLabel,
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
  const t = useTranslations("common");
  return (
    <AlertDialogFooter>
      <AlertDialogCancel
        data-action="cancel"
        aria-disabled={pending || undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {cancelLabel ?? t("cancel")}
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
