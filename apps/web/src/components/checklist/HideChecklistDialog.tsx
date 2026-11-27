"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(pending, onOpenChange)}
    >
      <AlertDialogContent onCloseAutoFocus={returnFocusTo(returnFocus)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("checklist.hideTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("checklist.hideDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          variant="default"
          pending={pending}
          label={t("checklist.hide")}
          pendingLabel={t("checklist.hiding")}
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
