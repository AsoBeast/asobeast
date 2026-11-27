"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import { Button } from "@/components/ui/button";
import { deleteApiToken } from "@/lib/api";
import {
  cardAction,
  siblingControl,
  useCloseFocusHandoff,
} from "@/lib/focus-handoff";
import { invalidateApiTokenMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

const REVOKE_CONTROL = 'button[data-action="revoke-token"]';

const revokeSuccessor = (trigger: HTMLElement | null): HTMLElement | null => {
  const row = trigger?.closest("tr") ?? null;
  return siblingControl(row, REVOKE_CONTROL) ?? cardAction(row);
};

export function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("integrations.tokens");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();

  const revoke = useMutation({
    mutationFn: () => deleteApiToken(id),
    onSuccess: () => {
      invalidateApiTokenMutation(queryClient);
      handOff(revokeSuccessor(trigger.current));
      setOpen(false);
      toast.success(t("revoked"));
    },
    onError: () => toast.error(t("revokeFailed")),
  });
  const revokeOnce = useSingleFlight(revoke);

  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(revoke.isPending, setOpen)}
    >
      <AlertDialogTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          data-action="revoke-token"
          aria-label={t("revokeAria", { name })}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("revokeBody", { name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={revoke.isPending}
          label={t("revoke")}
          pendingLabel={t("revoking")}
          onConfirm={revokeOnce}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
