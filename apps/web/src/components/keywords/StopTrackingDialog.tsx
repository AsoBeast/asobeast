"use client";

import type { RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

const ROW_MENU = "button[data-keyword-actions]";

const KEYWORD_SEARCH = "[data-keyword-search] input";

const focusSuccessor = (menu: HTMLElement | null): HTMLElement | null =>
  siblingControl(menu?.closest("tr") ?? null, ROW_MENU) ??
  document.querySelector<HTMLElement>(KEYWORD_SEARCH);

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
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();
  const remove = useMutation({
    mutationFn: () => removeKeyword(appId, keyword.keywordId),
    onSuccess: () => {
      invalidateKeywordMutation(queryClient, appId);
      toast.success(t("stop.success", { keyword: keyword.text }));
    },
    onError: () => toast.error(t("stop.failed", { keyword: keyword.text })),
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
          <AlertDialogTitle>
            {t("stop.title", { keyword: keyword.text })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("stop.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={remove.isPending}
          label={t("bulk.stop")}
          pendingLabel={t("bulk.removing")}
          onConfirm={() => {
            const successor = focusSuccessor(returnFocus.current);
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
