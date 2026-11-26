"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, deleteKeywordInspection } from "@/lib/api";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import { forgetKeywordInspection } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

const DELETE_CONTROL = "button[data-delete-inspection]";

const deleteSuccessor = (trigger: HTMLElement | null): HTMLElement | null =>
  siblingControl(trigger?.closest("li") ?? null, DELETE_CONTROL) ??
  document.getElementById("inspect-keyword");

export function DeleteInspectionButton({
  id,
  keyword,
  subject,
  onDeleted,
}: {
  id: string;
  keyword: string;
  subject: string;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("keywordInspector");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();
  const remove = useMutation({
    mutationFn: () => deleteKeywordInspection(id),
    onSuccess: () => {
      handOff(deleteSuccessor(trigger.current));
      forgetKeywordInspection(queryClient, id);
      setOpen(false);
      onDeleted(id);
      toast.success(t("inspector.delete.success"));
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("inspector.delete.failed"))),
  });
  const removeOnce = useSingleFlight(remove);

  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(remove.isPending, setOpen)}
    >
      <AlertDialogTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          data-delete-inspection
          aria-label={t("inspector.delete.trigger", { subject })}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("inspector.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("inspector.delete.description", { keyword })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={remove.isPending}
          label={common("delete")}
          pendingLabel={t("inspector.delete.deleting")}
          onConfirm={() => removeOnce(undefined)}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
