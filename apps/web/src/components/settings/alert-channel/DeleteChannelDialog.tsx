"use client";

import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmActionFooter } from "@/components/ConfirmActionFooter";
import { Button } from "@/components/ui/button";
import {
  cardAction,
  siblingControl,
  useCloseFocusHandoff,
} from "@/lib/focus-handoff";

const DELETE_CONTROL = 'button[aria-label^="Delete "]';

function deleteSuccessor(trigger: HTMLElement | null): HTMLElement | null {
  const row = trigger?.closest("li") ?? null;
  return siblingControl(row, DELETE_CONTROL) ?? cardAction(row);
}

export function DeleteChannelDialog({
  label,
  title,
  description,
  pending,
  onDelete,
}: {
  label: string;
  title: string;
  description: ReactNode;
  pending: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${label}`}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={pending}
          label="Delete"
          pendingLabel="Removing…"
          onConfirm={() => {
            const successor = deleteSuccessor(trigger.current);
            void onDelete().then(
              () => {
                handOff(successor);
                setOpen(false);
              },
              () => undefined,
            );
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
