"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { deleteApiToken } from "@/lib/api";
import { invalidateApiTokenMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const revoke = useMutation({
    mutationFn: () => deleteApiToken(id),
    onSuccess: () => {
      invalidateApiTokenMutation(queryClient);
      setOpen(false);
      toast.success("Token revoked");
    },
    onError: () => toast.error("Could not revoke the token"),
  });
  const revokeOnce = useSingleFlight(revoke);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Revoke ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
          <AlertDialogDescription>
            Anything using {name} will stop authenticating immediately. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={(event) => {
              event.preventDefault();
              revokeOnce();
            }}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
