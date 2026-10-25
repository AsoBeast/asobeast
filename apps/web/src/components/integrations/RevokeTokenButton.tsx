"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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

const REVOKE_CONTROL = 'button[aria-label^="Revoke "]';

const revokeSuccessor = (trigger: HTMLElement | null): HTMLElement | null => {
  const row = trigger?.closest("tr") ?? null;
  return siblingControl(row, REVOKE_CONTROL) ?? cardAction(row);
};

export function RevokeTokenButton({ id, name }: { id: string; name: string }) {
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
      toast.success("Token revoked");
    },
    onError: () => toast.error("Could not revoke the token"),
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
          aria-label={`Revoke ${name}`}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
          <AlertDialogDescription>
            Anything using {name} will stop authenticating immediately. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={revoke.isPending}
          label="Revoke"
          pendingLabel="Revoking…"
          onConfirm={revokeOnce}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
