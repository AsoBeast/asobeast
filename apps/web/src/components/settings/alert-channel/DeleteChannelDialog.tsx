"use client";

import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";

const DELETE_CONTROL = 'button[aria-label^="Delete "]';
const CARD = '[data-slot="card"]';
const CARD_ACTION = '[data-slot="card-header"] button';

function deleteSuccessor(trigger: HTMLElement | null): HTMLElement | null {
  const row = trigger?.closest("li") ?? null;
  return (
    siblingControl(row, DELETE_CONTROL) ??
    row?.closest(CARD)?.querySelector<HTMLElement>(CARD_ACTION) ??
    null
  );
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void onDelete().then(
                () => {
                  handOff(deleteSuccessor(trigger.current));
                  setOpen(false);
                },
                () => undefined,
              );
            }}
          >
            {pending ? "Removing…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
