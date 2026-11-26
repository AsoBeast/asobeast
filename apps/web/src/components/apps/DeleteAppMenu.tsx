"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteApp } from "@/lib/api";
import { appKeys, portfolioKey, removeAppQueries } from "@/lib/queries";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import { useSingleFlight } from "@/lib/single-flight";

const APP_ROW = "tr, li";
const ROW_LINK = "a[href]";
const SECTION_CONTROL = '[role="tab"][aria-selected="true"]';

function deleteSuccessor(trigger: HTMLElement | null): HTMLElement | null {
  const row = trigger?.closest(APP_ROW) ?? null;
  return (
    siblingControl(row, ROW_LINK) ??
    row?.closest("section")?.querySelector<HTMLElement>(SECTION_CONTROL) ??
    null
  );
}

export function DeleteAppMenu({ id, name }: { id: string; name: string }) {
  const t = useTranslations("apps");
  const commonT = useTranslations("common");
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();

  const mutation = useMutation({
    mutationFn: () => deleteApp(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appKeys.all });
      void queryClient.invalidateQueries({ queryKey: portfolioKey });
      removeAppQueries(queryClient, id);
      handOff(deleteSuccessor(trigger.current));
      setConfirmOpen(false);
      toast.success(t("delete.success", { name }));
    },
    onError: () => {
      toast.error(t("delete.error", { name }));
    },
  });
  const deleteOnce = useSingleFlight(mutation);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            ref={trigger}
            variant="ghost"
            size="icon-sm"
            aria-label={t("delete.actions", { name })}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 />
            {t("delete.item")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title", { name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {commonT("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteOnce();
              }}
            >
              {mutation.isPending ? t("delete.pending") : t("delete.item")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
