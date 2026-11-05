"use client";

import { useRef, useState } from "react";
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
import { deleteKeywordInspection } from "@/lib/api";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import { forgetKeywordInspection } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

const DELETE_CONTROL = 'button[aria-label^="Delete the inspection of "]';

const deleteSuccessor = (trigger: HTMLElement | null): HTMLElement | null =>
  siblingControl(trigger?.closest("li") ?? null, DELETE_CONTROL) ??
  document.getElementById("inspect-keyword");

export function DeleteInspectionButton({
  id,
  keyword,
  onDeleted,
}: {
  id: string;
  keyword: string;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
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
      toast.success("Inspection deleted");
    },
    onError: () => toast.error("Could not delete the inspection"),
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
          aria-label={`Delete the inspection of ${keyword}`}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this inspection?</AlertDialogTitle>
          <AlertDialogDescription>
            The saved results for “{keyword}” are removed, and later inspections
            of the keyword compare with the run before this one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={remove.isPending}
          label="Delete"
          pendingLabel="Deleting…"
          onConfirm={() => removeOnce(undefined)}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
