"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DELETION_CONFIRMATION,
  type WorkspaceDeletionStatus,
} from "@asobeast/shared";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/use-auth";
import {
  ApiError,
  cancelWorkspaceDeletion,
  scheduleWorkspaceDeletion,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  invalidateWorkspaceDeletion,
  workspaceDeletionOptions,
} from "@/lib/queries";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.envelope.message : fallback;
}

function ScheduleDeletionDialog({ graceDays }: { graceDays: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const schedule = useMutation({
    mutationFn: scheduleWorkspaceDeletion,
    onSuccess: () => {
      toast.success("Workspace scheduled for deletion");
      invalidateWorkspaceDeletion(queryClient);
      setOpen(false);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not schedule the deletion.")),
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setTyped("");
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete workspace
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Every app, keyword and history in it is erased after {graceDays}{" "}
            days. You can cancel until then.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workspace-deletion-confirm">
            Type {DELETION_CONFIRMATION} to confirm
          </Label>
          <Input
            id="workspace-deletion-confirm"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={schedule.isPending}>
            Keep workspace
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={typed !== DELETION_CONFIRMATION || schedule.isPending}
            onClick={(event) => {
              event.preventDefault();
              schedule.mutate();
            }}
          >
            {schedule.isPending ? "Scheduling…" : "Delete workspace"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelDeletionButton() {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: cancelWorkspaceDeletion,
    onSuccess: () => {
      toast.success("Deletion cancelled");
      invalidateWorkspaceDeletion(queryClient);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not cancel the deletion.")),
  });

  return (
    <Button
      variant="outline"
      disabled={cancel.isPending}
      onClick={() => cancel.mutate()}
    >
      {cancel.isPending ? "Cancelling…" : "Cancel deletion"}
    </Button>
  );
}

function ScheduledStatus({ deletion }: { deletion: WorkspaceDeletionStatus }) {
  return (
    <p className="text-body">
      {deletion.requestedBy ?? "The owner"} scheduled this workspace for
      deletion
      {deletion.requestedAt
        ? ` on ${formatDateTime(deletion.requestedAt)}`
        : ""}
      . It is erased on or after{" "}
      {deletion.dueAt ? formatDateTime(deletion.dueAt) : "the due date"}.
    </p>
  );
}

function DeletionControl({
  deletion,
  isOwner,
}: {
  deletion: WorkspaceDeletionStatus;
  isOwner: boolean;
}) {
  if (!isOwner) {
    return (
      <p className="text-body text-muted-foreground">
        Only the workspace owner can{" "}
        {deletion.scheduled ? "cancel this" : "delete this workspace"}.
      </p>
    );
  }
  return deletion.scheduled ? (
    <CancelDeletionButton />
  ) : (
    <ScheduleDeletionDialog graceDays={deletion.graceDays} />
  );
}

export function WorkspaceDeletionCard() {
  const { user } = useAuth();
  const { data: deletion } = useQuery(workspaceDeletionOptions);
  const isOwner = user?.role === "owner";

  if (!deletion) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete workspace</CardTitle>
        <CardDescription>
          Deleting erases every app, keyword and history in this workspace after
          a grace period of {deletion.graceDays} days, during which the owner
          can cancel it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        {deletion.scheduled ? <ScheduledStatus deletion={deletion} /> : null}
        <DeletionControl deletion={deletion} isOwner={isOwner} />
      </CardContent>
    </Card>
  );
}
